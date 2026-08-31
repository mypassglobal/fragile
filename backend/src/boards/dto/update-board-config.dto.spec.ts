import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateBoardConfigDto } from './update-board-config.dto.js';

/**
 * These tests mirror the global ValidationPipe config in main.ts
 * (`whitelist: true, transform: true`). `whitelist: true` strips any property
 * not decorated on the DTO, so a field missing its decorators is silently
 * dropped from the request body — this guards against that regression for the
 * MTTR incident-priority filter (feature 0027).
 */
function toDto(input: Record<string, unknown>): UpdateBoardConfigDto {
  // excludeExtraneousValues:false + the default plainToInstance behaviour maps
  // known props; whitelist stripping is exercised via validateSync + the
  // property being present on the instance.
  return plainToInstance(UpdateBoardConfigDto, input);
}

describe('UpdateBoardConfigDto — incidentPriorities', () => {
  it('accepts a string array and preserves the value', () => {
    const dto = toDto({ incidentPriorities: ['High', 'Highest'] });
    const errors = validateSync(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto.incidentPriorities).toEqual(['High', 'Highest']);
  });

  it('accepts an empty array (empty = all priorities qualify)', () => {
    const dto = toDto({ incidentPriorities: [] });
    const errors = validateSync(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto.incidentPriorities).toEqual([]);
  });

  it('is optional (absent value produces no validation error)', () => {
    const dto = toDto({ doneStatusNames: ['Done'] });
    const errors = validateSync(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto.incidentPriorities).toBeUndefined();
  });

  it('rejects a non-array value', () => {
    const dto = toDto({ incidentPriorities: 'Critical' });
    const errors = validateSync(dto, { whitelist: true });
    expect(errors.some((e) => e.property === 'incidentPriorities')).toBe(true);
  });

  it('rejects an array containing non-string elements', () => {
    const dto = toDto({ incidentPriorities: ['High', 42] });
    const errors = validateSync(dto, { whitelist: true });
    expect(errors.some((e) => e.property === 'incidentPriorities')).toBe(true);
  });

  // End-to-end proof against the SAME ValidationPipe config as main.ts.
  // This is the test that fails if incidentPriorities loses its decorators:
  // `whitelist: true` strips any undeclared property before it reaches the
  // controller, so an undecorated field can never persist via the API.
  it('survives the real whitelisting ValidationPipe (undeclared fields are stripped)', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const out = (await pipe.transform(
      { incidentPriorities: ['High'], notADtoField: 'x' },
      { type: 'body', metatype: UpdateBoardConfigDto },
    )) as UpdateBoardConfigDto & Record<string, unknown>;

    expect(out.incidentPriorities).toEqual(['High']); // declared → kept
    expect(out.notADtoField).toBeUndefined(); // undeclared → stripped
  });
});
