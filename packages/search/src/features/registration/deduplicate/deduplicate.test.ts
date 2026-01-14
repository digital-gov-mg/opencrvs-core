/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * OpenCRVS is also distributed under the terms of the Civil Registration
 * & Healthcare Disclaimer located at http://opencrvs.org/license.
 *
 * Copyright (C) The OpenCRVS Authors located at https://github.com/opencrvs/opencrvs-core/blob/master/AUTHORS.
 */
import {
  compareForBirthDuplication,
  compareForDeathDuplication
} from './test-util'
import { createHandlerSetup, SetupFn } from '@search/test/createHandlerSetup'

// Test timeout is increased due to the fact that testcontainers can take a while to pull Docker images
jest.setTimeout(10 * 60 * 1000)

const setupTestCases = async (setupFn: SetupFn) => {
  const { elasticClient } = await setupFn()

  return {
    elasticClient
  }
}

describe('deduplication tests', () => {
  const { setup, cleanup, shutdown } = createHandlerSetup()
  afterEach(cleanup)
  afterAll(shutdown)

  describe('standard check', () => {
    it('finds a duplicate with very similar details within 7 days', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            // Similar child's firstname(s)
            childFirstNames: ['John', 'Jonh'],
            // Similar child's lastname
            childFamilyName: ['Smith', 'Smith'],
            // Date of birth within 5 days (within ±7 day limit)
            childDoB: ['2011-11-11', '2011-11-13'],
            // Similar Mother's firstname(s)
            motherFirstNames: ['Mother', 'Mothera'],
            // Similar Mother's lastname.
            motherFamilyName: ['Smith', 'Smith'],
            // Similar Mother's date of birth (optional boost)
            motherDoB: ['2000-11-11', '2000-11-12'],
            // Same mother's NID (optional boost)
            motherIdentifier: ['23412387', '23412387']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(1)
    })

    it('finds a duplicate even with different mother nid if names and DOB match', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'John'],
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', '2011-11-13'], // Within 7 days
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12'],
            // Different mother's NID (but still should match due to name + DOB)
            motherIdentifier: ['23412387', '23412388']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(1)
    })

    it('finds no duplicates with very different details', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'Mathew'],
            childFamilyName: ['Smith', 'Wilson'],
            childDoB: ['2011-11-11', '2011-11-20'], // 9 days apart (outside ±7 day limit)
            motherFirstNames: ['Mother', 'Harriet'],
            motherFamilyName: ['Smith', 'Wilson'],
            motherDoB: ['2000-11-12', '1992-11-12'],
            motherIdentifier: ['23412387', '123123']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(0)
    })

    it('finds no duplicate if both the firstName & familyName for child is not given', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', ''],
            childFamilyName: ['Smith', ''],
            childDoB: ['2011-11-11', '2011-11-13'], // Within 7 days
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(0)
    })

    it('finds a duplicate even if the firstName of child is not given but family name matches', async () => {
      const t = await setupTestCases(setup)
      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', ''],
            childFamilyName: ['Smith', 'Smiht'], // Family name matches (fuzzy)
            childDoB: ['2011-11-11', '2011-11-13'], // Within 7 days
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(1)
    })

    it('finds a duplicate if only child first name matches (not family name)', async () => {
      const t = await setupTestCases(setup)
      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'John'], // First name matches
            childFamilyName: ['Smith', 'Wilson'], // Family name differs
            childDoB: ['2011-11-11', '2011-11-13'], // Within 7 days
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(1)
    })

    it('finds no duplicate if a required field (childDoB) is missing', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'Jhon'],
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', ''], // Missing child DOB
            motherDoB: ['2000-11-12', '2000-11-12'],
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(0)
    })

    it('finds no duplicate if child DOB is more than 7 days apart', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'John'],
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', '2011-11-19'], // 8 days apart (outside ±7 day limit)
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12'],
            motherIdentifier: ['23412387', '23412387']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(0)
    })

    it('finds a duplicate at the boundary of 7 days', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'John'],
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', '2011-11-18'], // Exactly 7 days apart
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(1)
    })
  })

  describe('same mother two births within 9 months of each other', () => {
    it('finds no duplicate when child names differ even within 7 days', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'Janet'], // Different child names
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', '2011-11-13'], // Within 7 days
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12'],
            motherIdentifier: ['23412387', '23412387']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(0)
    })

    it('finds no duplicate when child names differ and births are more than 7 days apart', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'Janet'], // Different child names
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', '2011-11-20'], // 9 days apart (outside limit)
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12'],
            motherIdentifier: ['23412387', '23412387']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(0)
    })
  })

  describe('child age increase/decrease', () => {
    it('finds no duplicate when child DOB is years apart (fraudulent records should not match)', async () => {
      const t = await setupTestCases(setup)
      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'John'],
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', '2014-11-01'], // 3 years apart (way outside ±7 day limit)
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12'],
            motherIdentifier: ['23412387', '23412387']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(0) // Changed from 1 to 0 - new stricter rules
    })
  })

  describe('edge cases for new stricter rules', () => {
    it('finds duplicate when only mother first name matches (not family name)', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'John'],
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', '2011-11-13'],
            motherFirstNames: ['Mother', 'Mother'], // First name matches
            motherFamilyName: ['Smith', 'Wilson'], // Family name differs
            motherDoB: ['2000-11-12', '2000-11-12']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(1)
    })

    it('finds duplicate when only mother family name matches (not first name)', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'John'],
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', '2011-11-13'],
            motherFirstNames: ['Mother', 'Harriet'], // First name differs
            motherFamilyName: ['Smith', 'Smith'], // Family name matches
            motherDoB: ['2000-11-12', '2000-11-12']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(1)
    })

    it('finds no duplicate when neither child name matches', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'Mathew'], // Different
            childFamilyName: ['Smith', 'Wilson'], // Different
            childDoB: ['2011-11-11', '2011-11-13'],
            motherFirstNames: ['Mother', 'Mother'],
            motherFamilyName: ['Smith', 'Smith'],
            motherDoB: ['2000-11-12', '2000-11-12']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(0)
    })

    it('finds no duplicate when neither mother name matches', async () => {
      const t = await setupTestCases(setup)

      await expect(
        compareForBirthDuplication(
          {
            childFirstNames: ['John', 'John'],
            childFamilyName: ['Smith', 'Smith'],
            childDoB: ['2011-11-11', '2011-11-13'],
            motherFirstNames: ['Mother', 'Harriet'], // Different
            motherFamilyName: ['Smith', 'Wilson'], // Different
            motherDoB: ['2000-11-12', '2000-11-12']
          },
          t.elasticClient
        )
      ).resolves.toHaveLength(0)
    })
  })

  describe('deduplication tests for death', () => {
    describe('standard check for death duplication', () => {
      it('finds a duplicate with very similar details', async () => {
        const t = await setupTestCases(setup)

        await expect(
          compareForDeathDuplication(
            {
              deceasedFirstNames: ['John', 'jhon'],
              deceasedFamilyName: ['koly', 'koly'],
              deceasedIdentifier: ['23412387', '23412387'],
              deathDate: ['2000-11-12', '2000-11-17'],
              deceasedDoB: ['2020-11-12', '2020-11-10']
            },
            t.elasticClient
          )
        ).resolves.toHaveLength(1)
      })

      it('finds no duplicate if a required field is missing', async () => {
        const t = await setupTestCases(setup)

        await expect(
          compareForDeathDuplication(
            {
              deceasedFirstNames: ['John', 'Jhon'],
              deceasedFamilyName: ['koly', 'koly'],
              deathDate: ['2000-11-12', '2000-11-12'],
              deceasedDoB: ['2020-11-12', '']
            },
            t.elasticClient
          )
        ).resolves.toHaveLength(0)
      })

      it('finds no duplicate if both the firstName & familyName of deceased is not given', async () => {
        const t = await setupTestCases(setup)
        await expect(
          compareForDeathDuplication(
            {
              deceasedFirstNames: ['John', ''],
              deceasedFamilyName: ['koly', ''],
              deceasedIdentifier: ['23412387', '23412387'],
              deathDate: ['2000-11-12', '2000-11-17'],
              deceasedDoB: ['2020-11-12', '2020-11-10']
            },
            t.elasticClient
          )
        ).resolves.toHaveLength(0)
      })

      it('finds duplicate even if the familyName of deceased is not given', async () => {
        const t = await setupTestCases(setup)

        await expect(
          compareForDeathDuplication(
            {
              deceasedFirstNames: ['John', 'Jonh'],
              deceasedFamilyName: ['koly', ''],
              deceasedIdentifier: ['23412387', '23412387'],
              deathDate: ['2000-11-12', '2000-11-17'],
              deceasedDoB: ['2020-11-12', '2020-11-10']
            },
            t.elasticClient
          )
        ).resolves.toHaveLength(1)
      })
    })
  })
})
