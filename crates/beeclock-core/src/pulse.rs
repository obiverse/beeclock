//! Pulse types.

use alloc::string::String;

use crate::PulseCondition;

/// Specification for a pulse.
#[derive(Clone, Debug)]
pub struct PulseSpec {
    pub name: String,
    pub condition: PulseCondition,
}

/// Emitted when a pulse fires.
#[derive(Clone, Debug)]
pub struct PulseFired {
    pub name: String,
    pub tick: u64,
    pub epoch: u64,
}
