//! WASM Clock builder.

use beeclock_core::{Clock, PartitionOrder, PartitionSpec, PulseCondition, PulseSpec};
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use crate::bridge::{get_string, get_u64};
use crate::WasmClock;

/// WASM-friendly clock builder.
#[wasm_bindgen]
pub struct WasmClockBuilder {
    partitions: Vec<PartitionSpec>,
    pulses: Vec<PulseSpec>,
    order: Option<PartitionOrder>,
}

#[wasm_bindgen]
impl WasmClockBuilder {
    /// Create a new builder.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            partitions: Vec::new(),
            pulses: Vec::new(),
            order: None,
        }
    }

    /// Set the partition order.
    ///
    /// Valid values: "lsf", "least", "least_significant_first",
    ///               "msf", "most", "most_significant_first"
    pub fn set_partition_order(&mut self, order: String) -> Result<(), JsValue> {
        let order = match order.as_str() {
            "lsf" | "least" | "least_significant_first" => PartitionOrder::LeastSignificantFirst,
            "msf" | "most" | "most_significant_first" => PartitionOrder::MostSignificantFirst,
            _ => {
                return Err(JsValue::from_str(
                    "order must be 'lsf' or 'msf' (least/most_significant_first)",
                ))
            }
        };
        self.order = Some(order);
        Ok(())
    }

    /// Add a partition with the given name and modulus.
    pub fn partition(&mut self, name: String, modulus: u64) {
        self.partitions.push(PartitionSpec { name, modulus });
    }

    /// Add a periodic pulse.
    pub fn pulse_every(&mut self, name: String, period: u64) {
        self.pulses.push(PulseSpec {
            name,
            condition: PulseCondition::Every(period),
        });
    }

    /// Add a pulse with a custom condition (JS object).
    pub fn pulse_condition(&mut self, name: String, condition: JsValue) -> Result<(), JsValue> {
        let condition = parse_condition(&condition)?;
        self.pulses.push(PulseSpec { name, condition });
        Ok(())
    }

    /// Build the clock.
    pub fn build(&mut self) -> Result<WasmClock, JsValue> {
        let partitions = std::mem::take(&mut self.partitions);
        let pulses = std::mem::take(&mut self.pulses);
        let partition_moduli = partitions.iter().map(|part| part.modulus).collect::<Vec<_>>();
        let pulse_names = pulses.iter().map(|pulse| pulse.name.clone()).collect::<Vec<_>>();
        let order = self
            .order
            .take()
            .ok_or_else(|| JsValue::from_str("partition order must be set"))?;

        Clock::new(order, partitions, pulses)
            .map(|inner| WasmClock {
                inner,
                partition_count: partition_moduli.len(),
                partition_moduli,
                pulse_names,
            })
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }
}

// ─────────────────────────────────────────────────────────────
// Condition Parsing
// ─────────────────────────────────────────────────────────────

fn parse_condition(value: &JsValue) -> Result<PulseCondition, JsValue> {
    let obj = Object::from(value.clone());
    let kind = Reflect::get(&obj, &JsValue::from_str("type"))
        .map_err(|_| JsValue::from_str("condition.type missing"))?;
    let kind = kind
        .as_string()
        .ok_or_else(|| JsValue::from_str("condition.type must be a string"))?;

    match kind.as_str() {
        "every" => {
            let period = get_u64(&obj, "period")?;
            Ok(PulseCondition::Every(period))
        }

        "partition_equals" => {
            let name = get_string(&obj, "name")?;
            let value = get_u64(&obj, "value")?;
            Ok(PulseCondition::PartitionEquals { name, value })
        }

        "partition_modulo" => {
            let name = get_string(&obj, "name")?;
            let modulus = get_u64(&obj, "modulus")?;
            let remainder = get_u64(&obj, "remainder")?;
            Ok(PulseCondition::PartitionModulo {
                name,
                modulus,
                remainder,
            })
        }

        "tick_range" => {
            let start = get_u64(&obj, "start")?;
            let end = get_u64(&obj, "end")?;
            Ok(PulseCondition::TickRange { start, end })
        }

        "not" => {
            let value = Reflect::get(&obj, &JsValue::from_str("condition"))
                .map_err(|_| JsValue::from_str("condition.condition missing for 'not'"))?;
            let condition = parse_condition(&value)?;
            Ok(PulseCondition::Not(Box::new(condition)))
        }

        "and" => {
            let conditions = get_conditions(&obj)?;
            Ok(PulseCondition::And(conditions))
        }

        "or" => {
            let conditions = get_conditions(&obj)?;
            Ok(PulseCondition::Or(conditions))
        }

        _ => Err(JsValue::from_str("unknown pulse condition type")),
    }
}

fn get_conditions(obj: &Object) -> Result<Vec<PulseCondition>, JsValue> {
    let value = Reflect::get(obj, &JsValue::from_str("conditions"))
        .map_err(|_| JsValue::from_str("condition.conditions missing"))?;
    let array = value
        .dyn_ref::<Array>()
        .ok_or_else(|| JsValue::from_str("condition.conditions must be an array"))?;

    let mut conditions = Vec::with_capacity(array.length() as usize);
    for idx in 0..array.length() {
        conditions.push(parse_condition(&array.get(idx))?);
    }
    Ok(conditions)
}
