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
  searchByCompositionId,
  updateComposition
} from '@search/elasticsearch/dbhelper'
import { BirthDocument, DeathDocument } from '@search/elasticsearch/utils'
import { get } from 'lodash'
import { ISearchResponse } from '@search/elasticsearch/client'
import { OPENCRVS_INDEX_NAME } from '@search/constants'
import { logger } from '@opencrvs/commons'
import { subDays, addDays } from 'date-fns'
import * as elasticsearch from '@elastic/elasticsearch'

const isNonEmptyCondition = <T>(
  value: T | null | undefined | ''
): value is T => {
  return Boolean(value)
}

export const removeDuplicate = async (
  bundle: fhir.Composition & { id: string },
  client: elasticsearch.Client
) => {
  const compositionId = bundle.id

  if (!compositionId) {
    throw new Error('No Composition ID found')
  }

  const composition = await searchByCompositionId(compositionId, client)

  const body = composition?.body.hits.hits[0]._source

  if (!body) {
    throw new Error(`No composition found by ID ${compositionId}`)
  }

  body.relatesTo = extractRelatesToIDs(bundle)
  await updateComposition(compositionId, body, client)
}

const extractRelatesToIDs = (bundle: fhir.Composition & { id: string }) => {
  const relatesToBundle = get(bundle, 'relatesTo') || []

  return relatesToBundle.map(
    (item) => item.targetReference?.reference?.replace('Composition/', '') ?? ''
  )
}

export const searchForBirthDuplicates = async (
  body: Partial<BirthDocument>,
  client: elasticsearch.Client
) => {
  // Names of length of 3 or less characters = 0 edits allowed
  // Names of length of 4 - 6 characters = 1 edit allowed
  // Names of length of >7 characters = 2 edits allowed
  const FIRST_NAME_FUZZINESS = 'AUTO:4,7'

  // Early return if essential fields are missing
  // Need at least one child name AND one mother name AND child DOB
  const hasChildName = body.childFirstNames || body.childFamilyName
  const hasMotherName = body.motherFirstNames || body.motherFamilyName

  if (!hasChildName || !hasMotherName || !body.childDoB) {
    return []
  }

  // MUST clauses: All required for a duplicate match
  const mustClauses: Array<Record<string, unknown>> = []

  // Child name match: At least ONE of (first OR family) must match
  const childNameShouldClauses: Array<Record<string, unknown>> = []

  if (body.childFirstNames) {
    childNameShouldClauses.push({
      match: {
        childFirstNames: {
          query: body.childFirstNames,
          fuzziness: FIRST_NAME_FUZZINESS
        }
      }
    })
  }

  if (body.childFamilyName) {
    childNameShouldClauses.push({
      match: {
        childFamilyName: {
          query: body.childFamilyName,
          fuzziness: FIRST_NAME_FUZZINESS
        }
      }
    })
  }

  if (childNameShouldClauses.length > 0) {
    mustClauses.push({
      bool: {
        should: childNameShouldClauses,
        minimum_should_match: 1
      }
    })
  }

  // Mother name match: At least ONE of (first OR family) must match
  const motherNameShouldClauses: Array<Record<string, unknown>> = []

  if (body.motherFirstNames) {
    motherNameShouldClauses.push({
      match: {
        motherFirstNames: {
          query: body.motherFirstNames,
          fuzziness: FIRST_NAME_FUZZINESS
        }
      }
    })
  }

  if (body.motherFamilyName) {
    motherNameShouldClauses.push({
      match: {
        motherFamilyName: {
          query: body.motherFamilyName,
          fuzziness: FIRST_NAME_FUZZINESS
        }
      }
    })
  }

  if (motherNameShouldClauses.length > 0) {
    mustClauses.push({
      bool: {
        should: motherNameShouldClauses,
        minimum_should_match: 1
      }
    })
  }

  // Child DOB: Within ±7 days (strict range)
  const childDoBDate = new Date(body.childDoB)
  mustClauses.push({
    range: {
      childDoB: {
        gte: subDays(childDoBDate, 7).toISOString(),
        lte: addDays(childDoBDate, 7).toISOString()
      }
    }
  })

  // SHOULD clauses: Boost confidence but not required
  const shouldClauses: Array<Record<string, unknown>> = []

  // Mother identifier: Exact match if present (high boost)
  if (body.motherIdentifier) {
    shouldClauses.push({
      term: {
        motherIdentifier: {
          value: body.motherIdentifier,
          boost: 2.0
        }
      }
    })
  }

  // Mother DOB: Within ±30 days (optional boost)
  if (body.motherDoB) {
    const motherDoBDate = new Date(body.motherDoB)
    shouldClauses.push({
      range: {
        motherDoB: {
          gte: subDays(motherDoBDate, 30).toISOString(),
          lte: addDays(motherDoBDate, 30).toISOString()
        }
      }
    })
  }

  try {
    const result = await client.search(
      {
        index: OPENCRVS_INDEX_NAME,
        query: {
          bool: {
            must: mustClauses,
            should: shouldClauses.length > 0 ? shouldClauses : undefined,
            minimum_should_match: 0
          }
        },
        min_score: 3.0
      },
      {
        meta: true
      }
    )

    return result.body.hits.hits as ISearchResponse<
      BirthDocument | DeathDocument
    >['hits']['hits']
  } catch (err) {
    logger.error(`searchBirthDuplicates error: ${err}`)
    throw err
  }
}

export const searchForDeathDuplicates = async (
  body: Partial<DeathDocument>,
  client: elasticsearch.Client
) => {
  const FIRST_NAME_FUZZINESS = 'AUTO:4,7'
  if (
    (!body.deceasedFirstNames && !body.deceasedFamilyName) ||
    !body.deceasedDoB ||
    !body.deathDate
  ) {
    return []
  }

  const deceasedsDetailsMatch = [
    body.deceasedFirstNames && {
      match: {
        deceasedFirstNames: {
          query: body.deceasedFirstNames,
          fuzziness: FIRST_NAME_FUZZINESS
        }
      }
    },
    body.deceasedFamilyName && {
      match: {
        deceasedFamilyName: {
          query: body.deceasedFamilyName,
          fuzziness: FIRST_NAME_FUZZINESS
        }
      }
    },
    body.deceasedIdentifier && {
      match_phrase: {
        deceasedIdentifier: body.deceasedIdentifier
      }
    }
  ].filter(isNonEmptyCondition)

  const deathDateWithinRange = [
    body.deathDate && {
      range: {
        deathDate: {
          gte: subDays(new Date(body.deathDate), 5).toISOString(),
          lte: addDays(new Date(body.deathDate), 5).toISOString()
        }
      }
    },
    body.deathDate && {
      distance_feature: {
        field: 'deathDate',
        pivot: '5d', // 5 days
        origin: new Date(body.deathDate).toISOString(),
        boost: 1
      }
    }
  ].filter(isNonEmptyCondition)

  const birthDateWithinRange = [
    body.deceasedDoB && {
      range: {
        deceasedDoB: {
          gte: subDays(new Date(body.deceasedDoB), 5).toISOString(),
          lte: addDays(new Date(body.deceasedDoB), 5).toISOString()
        }
      }
    },
    body.deceasedDoB && {
      distance_feature: {
        field: 'deceasedDoB',
        pivot: '5d', // 5 days
        origin: new Date(body.deceasedDoB).toISOString(),
        boost: 1
      }
    }
  ].filter(isNonEmptyCondition)

  try {
    const result = await client.search(
      {
        index: OPENCRVS_INDEX_NAME,
        query: {
          bool: {
            must: [
              ...deceasedsDetailsMatch,
              {
                bool: {
                  must: deathDateWithinRange
                }
              },
              {
                bool: {
                  must: birthDateWithinRange
                }
              }
            ]
          }
        }
      },
      {
        meta: true
      }
    )
    return result.body.hits.hits as ISearchResponse<
      BirthDocument | DeathDocument
    >['hits']['hits']
  } catch (err) {
    logger.error(`searchDeathDuplicates error: ${err}`)
    throw err
  }
}
