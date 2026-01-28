//! Subscriber types for std environments.

use std::sync::mpsc::{Sender, SyncSender, TrySendError};

use crate::TickOutcome;

/// A subscriber that receives tick outcomes.
#[derive(Debug)]
pub enum Subscriber {
    /// Unbounded channel (never blocks, may OOM).
    Unbounded(Sender<TickOutcome>),
    /// Bounded channel (drops on full).
    Bounded(SyncSender<TickOutcome>),
}

impl Subscriber {
    /// Send an outcome to this subscriber.
    /// Returns false if the subscriber is disconnected.
    pub fn send(&self, outcome: &TickOutcome) -> bool {
        match self {
            Subscriber::Unbounded(tx) => tx.send(outcome.clone()).is_ok(),
            Subscriber::Bounded(tx) => match tx.try_send(outcome.clone()) {
                Ok(()) => true,
                Err(TrySendError::Full(_)) => true, // Drop, but keep subscriber
                Err(TrySendError::Disconnected(_)) => false,
            },
        }
    }
}
