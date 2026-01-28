//! Partition types and logic.

use alloc::string::String;

/// Specification for a partition (a mixed-radix digit).
#[derive(Clone, Debug)]
pub struct PartitionSpec {
    pub name: String,
    pub modulus: u64,
}

/// Defines how partitions are ordered by significance.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum PartitionOrder {
    /// Least-significant partition first (sec, min, hour).
    LeastSignificantFirst,
    /// Most-significant partition first (hour, min, sec).
    MostSignificantFirst,
}

/// Runtime state for a partition.
#[derive(Clone, Debug)]
pub struct PartitionState {
    pub name: String,
    pub value: u64,
    pub modulus: u64,
}

impl PartitionState {
    /// Create a new partition state from a spec.
    pub fn from_spec(spec: &PartitionSpec) -> Self {
        Self {
            name: spec.name.clone(),
            value: 0,
            modulus: spec.modulus,
        }
    }

    /// Increment the partition, returning true if it overflowed (carry).
    #[inline]
    pub fn increment(&mut self) -> bool {
        self.value += 1;
        if self.value >= self.modulus {
            self.value = 0;
            true
        } else {
            false
        }
    }
}
