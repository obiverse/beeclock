//! # BeeClock Core
//!
//! A logical clock with partitioned time and predicate-based pulses.
//!
//! ## Overview
//!
//! BeeClock provides a tick-driven clock where time is represented as
//! partitions (like sec/min/hour) that cascade on overflow. Pulses fire
//! based on configurable predicates.
//!
//! ## Features
//!
//! - **Partitioned Time**: Mixed-radix counter (e.g., 60-60-24 for time)
//! - **Predicate Pulses**: Fire events based on tick conditions
//! - **No Allocation After Init**: All memory allocated upfront
//! - **no_std Compatible**: Works in embedded/WASM environments
//!
//! ## Example
//!
//! ```rust
//! use beeclock_core::{Clock, PulseCondition};
//!
//! let mut clock = Clock::builder()
//!     .least_significant_first()
//!     .partition("sec", 60)
//!     .partition("min", 60)
//!     .partition("hour", 24)
//!     .pulse_every("second", 1)
//!     .pulse_when("noon", PulseCondition::And(vec![
//!         PulseCondition::PartitionEquals { name: "hour".into(), value: 12 },
//!         PulseCondition::PartitionEquals { name: "min".into(), value: 0 },
//!         PulseCondition::PartitionEquals { name: "sec".into(), value: 0 },
//!     ]))
//!     .build()
//!     .unwrap();
//!
//! let outcome = clock.tick();
//! println!("Tick: {}, Pulses: {:?}", outcome.snapshot.tick, outcome.pulses);
//! ```

#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

mod clock;
mod condition;
mod error;
mod partition;
mod pulse;
mod snapshot;

pub use clock::{Clock, ClockBuilder};
pub use condition::PulseCondition;
pub use error::ClockError;
pub use partition::{PartitionOrder, PartitionSpec, PartitionState};
pub use pulse::{PulseFired, PulseSpec};
pub use snapshot::{ClockSnapshot, TickOutcome};

#[cfg(feature = "std")]
mod subscriber;

#[cfg(feature = "std")]
pub use subscriber::Subscriber;
