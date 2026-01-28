import { TestBed } from '@angular/core/testing';

import { Wasm } from './wasm';

describe('Wasm', () => {
  let service: Wasm;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Wasm);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
