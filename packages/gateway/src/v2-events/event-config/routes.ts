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
import { DEFAULT_TIMEOUT } from '@gateway/constants'
import { env } from '@gateway/environment'
import { ServerRoute } from '@hapi/hapi'
import { logger } from '@opencrvs/commons'

export const trpcProxy = [
  {
    method: '*',
    path: '/events/{path*}',
    handler: (req, h) => {
      logger.info(`Proxying request to ${req.params.path}`)

      return h.proxy({
        uri:
          new URL(req.params.path, env.EVENTS_URL).toString() + req.url.search,
        passThrough: true
      })
    },
    options: {
      payload: {
        output: 'data',
        parse: false,
        timeout: DEFAULT_TIMEOUT
      }
    }
  }
] satisfies Array<ServerRoute>
