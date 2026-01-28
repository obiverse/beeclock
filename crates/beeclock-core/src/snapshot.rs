//! Clock snapshot and tick outcome types.

use alloc::vec::Vec;

use crate::{PartitionState, PulseFired};

/// Immutable snapshot of the clock state at a tick.
#[derive(Clone, Debug)]
pub struct ClockSnapshot {
    pub tick: u64,
    pub epoch: u64,
    pub partitions: Vec<PartitionState>,
}

impl ClockSnapshot {
    /// Get a partition by name.
    pub fn partition(&self, name: &str) -> Option<&PartitionState> {
        self.partitions.iter().find(|p| p.name == name)
    }

    /// Get a partition value by name, returning 0 if not found.
    pub fn get(&self, name: &str) -> u64 {
        self.partition(name).map(|p| p.value).unwrap_or(0)
    }
}

/// Result of a single tick: snapshot + fired pulses.
#[derive(Clone, Debug)]
pub struct TickOutcome {
    pub snapshot: ClockSnapshot,
    pub pulses: Vec<PulseFired>,
    pub overflowed: bool,
}
