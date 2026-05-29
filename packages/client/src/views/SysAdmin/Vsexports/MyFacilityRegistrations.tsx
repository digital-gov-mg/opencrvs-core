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
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useIntl } from 'react-intl'
import { useQuery } from '@tanstack/react-query'
import styled from 'styled-components'
import { getUserDetails } from '@client/profile/profileSelectors'
import { useTRPC } from '@client/v2-events/trpc'
import { useEventConfigurations } from '@client/v2-events/features/events/useEventConfiguration'
import { Content, BodyContent } from '@opencrvs/components/lib/Content'
import { Button } from '@opencrvs/components/lib/Button'
import { Spinner } from '@opencrvs/components/lib/Spinner'
import {
  ListViewSimplified,
  ListViewItemSimplified
} from '@opencrvs/components/lib/ListViewSimplified'
import { FormTabs } from '@opencrvs/components/lib/FormTabs'
import { EventType } from '@client/utils/gateway'

const PageContent = styled(BodyContent)`
  padding: 0px;
  margin: 8px auto 0;
`

const FilterRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`

const PERIODS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: 'Cette semaine' },
  { id: 'month', label: 'Ce mois' },
  { id: 'all', label: 'Tout' }
] as const

type Period = (typeof PERIODS)[number]['id']

function getDateRange(period: Period): { gte?: string; lte?: string } {
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  if (period === 'today') {
    return { gte: startOfDay.toISOString() }
  }
  if (period === 'week') {
    const startOfWeek = new Date(startOfDay)
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay())
    return { gte: startOfWeek.toISOString() }
  }
  if (period === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return { gte: startOfMonth.toISOString() }
  }
  return {}
}

function exportToCSV(
  rows: { type: string; title: string; status: string; createdAt: string }[],
  filename: string
) {
  const header = 'Type,Nom,Statut,Date\n'
  const body = rows
    .map((r) => `"${r.type}","${r.title}","${r.status}","${r.createdAt}"`)
    .join('\n')
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function MyFacilityRegistrations() {
  const intl = useIntl()
  const userDetails = useSelector(getUserDetails)
  const [period, setPeriod] = useState<Period>('month')
  const [activeTab, setActiveTab] = useState<string>('all')
  const trpc = useTRPC()
  const eventConfigs = useEventConfigurations()

  const dateRange = getDateRange(period)

  const { data, isLoading } = useQuery({
    ...trpc.event.myRegistrations.queryOptions({
      gte: dateRange.gte,
      eventType: activeTab !== 'all' ? activeTab : undefined
    }),
    staleTime: 0,
    refetchOnMount: 'always'
  })

  const events = data?.results ?? []

  const tabSections = [
    { id: 'all', title: 'Tous' },
    { id: EventType.Birth, title: 'Naissances' },
    { id: EventType.Death, title: 'Décès' }
  ]

  const rows = events.map((event) => {
    const config = eventConfigs.find(({ id }) => id === event.type)
    const nameField = event.declaration?.['child.name'] as
      | { firstname?: string; surname?: string }
      | undefined
    const displayName =
      nameField
        ? `${nameField.firstname ?? ''} ${nameField.surname ?? ''}`.trim()
        : event.trackingId ?? '-'
    return {
      type: config ? intl.formatMessage(config.label) : event.type,
      title: displayName,
      status: event.status,
      createdAt: new Date(event.createdAt).toLocaleDateString('fr-FR')
    }
  })

  return (
    <PageContent>
      <Content
        title="Mes enregistrements"
        titleColor="copy"
        subtitle={`Formation sanitaire : ${userDetails?.primaryOffice?.name ?? '-'}`}
        tabBarContent={
          <FormTabs
            sections={tabSections}
            activeTabId={activeTab}
            onTabClick={(id) => setActiveTab(id)}
          />
        }
      >
        <FilterRow>
          {PERIODS.map((p) => (
            <Button
              key={p.id}
              type={period === p.id ? 'primary' : 'secondary'}
              size="small"
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            type="secondary"
            size="small"
            onClick={() =>
              exportToCSV(
                rows,
                `enregistrements-${userDetails?.primaryOffice?.name ?? 'fs'}-${period}.csv`
              )
            }
          >
            Exporter CSV
          </Button>
        </FilterRow>

        {isLoading ? (
          <Spinner id="loading-registrations" size={24} />
        ) : rows.length === 0 ? (
          <p>Aucun enregistrement trouvé.</p>
        ) : (
          <ListViewSimplified>
            {rows.map((row, i) => (
              <ListViewItemSimplified
                key={i}
                label={<strong>{row.title}</strong>}
                value={`${row.type} — ${row.status}`}
                actions={<span>{row.createdAt}</span>}
              />
            ))}
          </ListViewSimplified>
        )}
      </Content>
    </PageContent>
  )
}
