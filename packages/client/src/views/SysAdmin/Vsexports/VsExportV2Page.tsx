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
import React from 'react'
import { useSelector } from 'react-redux'
import { AppBar, Frame } from '@opencrvs/components'
import { ProfileMenu } from '@client/components/ProfileMenu'
import { Sidebar } from '@client/v2-events/layouts/sidebar/Sidebar'
import { TRPCProvider } from '@client/v2-events/trpc'
import { getUserDetails } from '@client/profile/profileSelectors'
import { MyFacilityRegistrations } from './MyFacilityRegistrations'

export function VsExportV2Page() {
  const currentUser = useSelector(getUserDetails)

  if (!currentUser) {
    return null
  }

  return (
    <TRPCProvider storeIdentifier={currentUser.id}>
      <Frame
        header={<AppBar desktopRight={<ProfileMenu key="profileMenu" />} />}
        navigation={<Sidebar />}
        skipToContentText="skip"
      >
        <MyFacilityRegistrations />
      </Frame>
    </TRPCProvider>
  )
}
