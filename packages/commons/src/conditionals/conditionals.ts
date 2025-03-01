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

import { JSONSchemaType } from 'ajv'
import { z } from 'zod'
import { ActionFormData, EventDocument } from '../events'

export function Conditional() {
  /*
   * Using JSONSchema directly here would cause a
   * "The inferred type of this node exceeds the maximum length the compiler will serialize."
   * error, so I've copied the type here
   */
  return z.any()
}

export type ConditionalParameters = { $now: string } & (
  | {
      $event: EventDocument
    }
  | {
      $event: EventDocument
      $form: ActionFormData
    }
  | {
      $form: ActionFormData
    }
)

/** @knipignore */
export type JSONSchema = Omit<
  JSONSchemaType<ConditionalParameters>,
  'properties'
>
