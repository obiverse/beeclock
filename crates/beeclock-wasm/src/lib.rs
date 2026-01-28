//! # BeeClock WASM
//!
//! WebAssembly bindings for beeclock-core.
//!
//! Provides `WasmClock` and `WasmClockBuilder` for use in JavaScript/TypeScript.

mod bridge;
mod builder;
mod clock;

pub use builder::WasmClockBuilder;
pub use clock::WasmClock;
