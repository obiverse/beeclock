//! Pulse condition predicates.

use alloc::boxed::Box;
use alloc::string::String;
use alloc::vec::Vec;

use crate::ClockSnapshot;

/// Predicate describing when a pulse should fire.
#[derive(Clone, Debug)]
pub enum PulseCondition {
    /// Fire every N ticks (starting at tick N).
    Every(u64),

    /// Fire when a partition equals a specific value.
    PartitionEquals { name: String, value: u64 },

    /// Fire when a partition value modulo `modulus` equals `remainder`.
    PartitionModulo {
        name: String,
        modulus: u64,
        remainder: u64,
    },

    /// Fire when tick is within an inclusive range.
    TickRange { start: u64, end: u64 },

    /// Logical negation of another condition.
    Not(Box<PulseCondition>),

    /// All conditions must be true.
    And(Vec<PulseCondition>),

    /// Any condition must be true.
    Or(Vec<PulseCondition>),
}

impl PulseCondition {
    /// Evaluate whether this condition is met at the given tick and snapshot.
    pub fn is_met(&self, tick: u64, snapshot: &ClockSnapshot) -> bool {
        match self {
            PulseCondition::Every(period) => tick != 0 && tick % period == 0,

            PulseCondition::PartitionEquals { name, value } => snapshot
                .partition(name)
                .map(|part| part.value == *value)
                .unwrap_or(false),

            PulseCondition::PartitionModulo {
                name,
                modulus,
                remainder,
            } => snapshot
                .partition(name)
                .map(|part| {
                    if *modulus == 0 {
                        false
                    } else {
                        part.value % modulus == *remainder
                    }
                })
                .unwrap_or(false),

            PulseCondition::TickRange { start, end } => tick >= *start && tick <= *end,

            PulseCondition::Not(condition) => !condition.is_met(tick, snapshot),

            PulseCondition::And(conditions) => {
                !conditions.is_empty()
                    && conditions.iter().all(|c| c.is_met(tick, snapshot))
            }

            PulseCondition::Or(conditions) => {
                conditions.iter().any(|c| c.is_met(tick, snapshot))
            }
        }
    }
}
