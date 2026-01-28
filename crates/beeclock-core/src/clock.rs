//! Clock implementation and builder.

use alloc::collections::BTreeSet;
use alloc::string::{String, ToString};
use alloc::vec::Vec;

use crate::{
    ClockError, ClockSnapshot, PartitionOrder, PartitionSpec, PartitionState, PulseCondition,
    PulseFired, PulseSpec, TickOutcome,
};

#[cfg(feature = "std")]
use std::sync::mpsc::{self, Receiver};

#[cfg(feature = "std")]
use crate::Subscriber;

/// Logical clock with partitioned time and predicate pulses.
#[derive(Debug)]
pub struct Clock {
    tick: u64,
    epoch: u64,
    partitions: Vec<PartitionState>,
    partition_order: PartitionOrder,
    pulses: Vec<PulseSpec>,
    #[cfg(feature = "std")]
    subscribers: Vec<Subscriber>,
}

impl Clock {
    /// Create a builder for configuring partitions, order, and pulses.
    pub fn builder() -> ClockBuilder {
        ClockBuilder::new()
    }

    /// Construct a clock with explicit partition order.
    pub fn new(
        partition_order: PartitionOrder,
        partitions: Vec<PartitionSpec>,
        pulses: Vec<PulseSpec>,
    ) -> Result<Self, ClockError> {
        // Validate partitions
        let known_partitions: BTreeSet<String> =
            partitions.iter().map(|p| p.name.clone()).collect();

        let mut states = Vec::with_capacity(partitions.len());
        for spec in &partitions {
            if spec.modulus == 0 {
                return Err(ClockError::ZeroModulus {
                    name: spec.name.clone(),
                });
            }
            states.push(PartitionState::from_spec(spec));
        }

        // Validate pulse conditions
        for pulse in &pulses {
            validate_condition(&pulse.condition, &known_partitions, &pulse.name)?;
        }

        Ok(Self {
            tick: 0,
            epoch: 0,
            partitions: states,
            partition_order,
            pulses,
            #[cfg(feature = "std")]
            subscribers: Vec::new(),
        })
    }

    /// Get the current tick count.
    #[inline]
    pub fn tick_count(&self) -> u64 {
        self.tick
    }

    /// Get the current epoch (increments on tick overflow).
    #[inline]
    pub fn epoch(&self) -> u64 {
        self.epoch
    }

    /// Get a snapshot without advancing time.
    pub fn snapshot(&self) -> ClockSnapshot {
        ClockSnapshot {
            tick: self.tick,
            epoch: self.epoch,
            partitions: self.partitions.clone(),
        }
    }

    /// Subscribe with an unbounded channel (backpressure ignored).
    #[cfg(feature = "std")]
    pub fn subscribe(&mut self) -> Receiver<TickOutcome> {
        let (tx, rx) = mpsc::channel();
        self.subscribers.push(Subscriber::Unbounded(tx));
        rx
    }

    /// Subscribe with a bounded channel (drops on full).
    #[cfg(feature = "std")]
    pub fn subscribe_bounded(&mut self, capacity: usize) -> Receiver<TickOutcome> {
        let (tx, rx) = mpsc::sync_channel(capacity);
        self.subscribers.push(Subscriber::Bounded(tx));
        rx
    }

    /// Advance logical time by one tick and return the outcome.
    pub fn tick(&mut self) -> TickOutcome {
        // Advance tick counter
        let (next_tick, overflowed) = self.tick.overflowing_add(1);
        self.tick = next_tick;
        if overflowed {
            self.epoch = self.epoch.wrapping_add(1);
        }

        // Advance partitions
        self.advance_partitions();

        // Build snapshot
        let snapshot = self.snapshot();

        // Evaluate pulses
        let mut fired = Vec::new();
        for pulse in &self.pulses {
            if pulse.condition.is_met(self.tick, &snapshot) {
                fired.push(PulseFired {
                    name: pulse.name.clone(),
                    tick: self.tick,
                    epoch: self.epoch,
                });
            }
        }

        // Add overflow pulse if applicable
        if overflowed {
            fired.push(PulseFired {
                name: "__overflow__".to_string(),
                tick: self.tick,
                epoch: self.epoch,
            });
        }

        let outcome = TickOutcome {
            snapshot,
            pulses: fired,
            overflowed,
        };

        // Broadcast to subscribers
        #[cfg(feature = "std")]
        self.broadcast(&outcome);

        outcome
    }

    fn advance_partitions(&mut self) {
        let mut carry = true;
        match self.partition_order {
            PartitionOrder::LeastSignificantFirst => {
                for partition in &mut self.partitions {
                    if !carry {
                        break;
                    }
                    carry = partition.increment();
                }
            }
            PartitionOrder::MostSignificantFirst => {
                for partition in self.partitions.iter_mut().rev() {
                    if !carry {
                        break;
                    }
                    carry = partition.increment();
                }
            }
        }
    }

    #[cfg(feature = "std")]
    fn broadcast(&mut self, outcome: &TickOutcome) {
        self.subscribers.retain(|sub| sub.send(outcome));
    }
}

impl Default for Clock {
    fn default() -> Self {
        Clock::builder()
            .least_significant_first()
            .partition("sec", 60)
            .partition("min", 60)
            .partition("hour", 24)
            .build()
            .expect("default clock configuration should be valid")
    }
}

/// Builder for configuring a clock.
#[derive(Debug, Default)]
pub struct ClockBuilder {
    partitions: Vec<PartitionSpec>,
    pulses: Vec<PulseSpec>,
    order: Option<PartitionOrder>,
}

impl ClockBuilder {
    /// Start a new builder with no partitions or pulses.
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the partition order explicitly.
    pub fn partition_order(mut self, order: PartitionOrder) -> Self {
        self.order = Some(order);
        self
    }

    /// Configure least-significant-first order.
    pub fn least_significant_first(self) -> Self {
        self.partition_order(PartitionOrder::LeastSignificantFirst)
    }

    /// Configure most-significant-first order.
    pub fn most_significant_first(self) -> Self {
        self.partition_order(PartitionOrder::MostSignificantFirst)
    }

    /// Add a single partition.
    pub fn partition(mut self, name: impl Into<String>, modulus: u64) -> Self {
        self.partitions.push(PartitionSpec {
            name: name.into(),
            modulus,
        });
        self
    }

    /// Add partitions in an explicit order.
    pub fn partition_chain<I>(mut self, order: PartitionOrder, specs: I) -> Self
    where
        I: IntoIterator<Item = PartitionSpec>,
    {
        self.order = Some(order);
        self.partitions.extend(specs);
        self
    }

    /// Add a periodic pulse.
    pub fn pulse_every(mut self, name: impl Into<String>, period: u64) -> Self {
        self.pulses.push(PulseSpec {
            name: name.into(),
            condition: PulseCondition::Every(period),
        });
        self
    }

    /// Add a predicate-based pulse.
    pub fn pulse_when(mut self, name: impl Into<String>, condition: PulseCondition) -> Self {
        self.pulses.push(PulseSpec {
            name: name.into(),
            condition,
        });
        self
    }

    /// Build the configured clock.
    pub fn build(self) -> Result<Clock, ClockError> {
        let order = match self.order {
            Some(order) => order,
            None => {
                if self.partitions.is_empty() {
                    PartitionOrder::LeastSignificantFirst
                } else {
                    return Err(ClockError::MissingPartitionOrder);
                }
            }
        };
        Clock::new(order, self.partitions, self.pulses)
    }
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

fn validate_condition(
    condition: &PulseCondition,
    partitions: &BTreeSet<String>,
    pulse_name: &str,
) -> Result<(), ClockError> {
    match condition {
        PulseCondition::Every(period) => {
            if *period == 0 {
                Err(ClockError::ZeroPeriod {
                    name: pulse_name.to_string(),
                })
            } else {
                Ok(())
            }
        }

        PulseCondition::PartitionEquals { name, .. } => {
            if partitions.contains(name) {
                Ok(())
            } else {
                Err(ClockError::UnknownPartition {
                    pulse: pulse_name.to_string(),
                    partition: name.clone(),
                })
            }
        }

        PulseCondition::PartitionModulo { name, modulus, .. } => {
            if *modulus == 0 {
                return Err(ClockError::ZeroConditionModulus {
                    pulse: pulse_name.to_string(),
                    partition: name.clone(),
                });
            }
            if partitions.contains(name) {
                Ok(())
            } else {
                Err(ClockError::UnknownPartition {
                    pulse: pulse_name.to_string(),
                    partition: name.clone(),
                })
            }
        }

        PulseCondition::TickRange { start, end } => {
            if start > end {
                Err(ClockError::InvalidTickRange {
                    pulse: pulse_name.to_string(),
                    start: *start,
                    end: *end,
                })
            } else {
                Ok(())
            }
        }

        PulseCondition::Not(inner) => validate_condition(inner, partitions, pulse_name),

        PulseCondition::And(conditions) | PulseCondition::Or(conditions) => {
            for c in conditions {
                validate_condition(c, partitions, pulse_name)?;
            }
            Ok(())
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tick_cascades_partitions() {
        let mut clock = Clock::builder()
            .least_significant_first()
            .partition("sec", 2)
            .partition("min", 3)
            .build()
            .unwrap();

        let tick1 = clock.tick();
        assert_eq!(tick1.snapshot.partition("sec").unwrap().value, 1);
        assert_eq!(tick1.snapshot.partition("min").unwrap().value, 0);

        let tick2 = clock.tick();
        assert_eq!(tick2.snapshot.partition("sec").unwrap().value, 0);
        assert_eq!(tick2.snapshot.partition("min").unwrap().value, 1);
    }

    #[test]
    fn pulses_fire_on_period() {
        let mut clock = Clock::builder()
            .least_significant_first()
            .partition("sec", 10)
            .pulse_every("pulse", 3)
            .build()
            .unwrap();

        assert!(clock.tick().pulses.is_empty());
        assert!(clock.tick().pulses.is_empty());

        let tick3 = clock.tick();
        assert_eq!(tick3.pulses.len(), 1);
        assert_eq!(tick3.pulses[0].name, "pulse");
    }

    #[test]
    fn default_clock_works() {
        let mut clock = Clock::default();
        let outcome = clock.tick();
        assert_eq!(outcome.snapshot.tick, 1);
        assert_eq!(outcome.snapshot.get("sec"), 1);
        assert_eq!(outcome.snapshot.get("min"), 0);
        assert_eq!(outcome.snapshot.get("hour"), 0);
    }
}
