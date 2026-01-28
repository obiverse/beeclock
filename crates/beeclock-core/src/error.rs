//! Clock error types.

use alloc::string::String;
use core::fmt;

/// Errors that can occur when building or running a clock.
#[derive(Debug, Clone)]
pub enum ClockError {
    /// Partition modulus must be greater than 0.
    ZeroModulus { name: String },

    /// Pulse period must be greater than 0.
    ZeroPeriod { name: String },

    /// Partition order must be specified when partitions exist.
    MissingPartitionOrder,

    /// Pulse references an unknown partition.
    UnknownPartition { pulse: String, partition: String },

    /// Pulse condition has zero modulus.
    ZeroConditionModulus { pulse: String, partition: String },

    /// Tick range is invalid (start > end).
    InvalidTickRange { pulse: String, start: u64, end: u64 },
}

impl fmt::Display for ClockError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ClockError::ZeroModulus { name } => {
                write!(f, "partition modulus must be > 0 for '{name}'")
            }
            ClockError::ZeroPeriod { name } => {
                write!(f, "pulse period must be > 0 for '{name}'")
            }
            ClockError::MissingPartitionOrder => {
                write!(f, "partition order must be specified explicitly")
            }
            ClockError::UnknownPartition { pulse, partition } => {
                write!(f, "pulse '{pulse}' references unknown partition '{partition}'")
            }
            ClockError::ZeroConditionModulus { pulse, partition } => {
                write!(
                    f,
                    "pulse '{pulse}' references partition '{partition}' with zero modulus"
                )
            }
            ClockError::InvalidTickRange { pulse, start, end } => {
                write!(f, "pulse '{pulse}' has invalid tick range ({start}..={end})")
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for ClockError {}
