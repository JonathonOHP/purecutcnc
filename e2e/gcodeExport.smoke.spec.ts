/**
 * Copyright 2026 Franja (Frank) Povazanj
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Export G-code dialog smoke: the operation checklist (issue #274) and the
 * error tier (issue #755).
 *
 * Covers the per-operation entry point (the Properties-header action
 * pre-checks only the selected operation), the default set from the header
 * Export button, the disabled state when nothing is checked, and a program
 * that changes tool with M6 off — reported as an error that blocks the export,
 * where a program whose operations share one tool is not.
 */

import { test, expect } from './fixtures'
import { seedGcodeExportProject } from './gcodeExport.helpers'
import type { Page } from '@playwright/test'

/**
 * Replace the platform's save entry point with a probe. Every export must call
 * it with an explicit `null` destination (issue #1081); a previous path is never
 * permission to overwrite. `success` and `cancel` answer immediately; `pending`
 * hands the test the resolver so it can open another document mid-save.
 */
async function installExportSaveProbe(
  page: Page,
  mode: 'success' | 'cancel' | 'pending',
): Promise<void> {
  await page.evaluate(async (probeMode) => {
    const module = await import('/src/platform/index.ts') as {
      platform: { saveTextFile: (...args: unknown[]) => Promise<string | null> }
    }
    const probe = window as unknown as {
      __exportSaveCalls: unknown[][]
      __resolveExportSave: ((path: string | null) => void) | null
    }
    probe.__exportSaveCalls = []
    probe.__resolveExportSave = null
    module.platform.saveTextFile = async (...args: unknown[]) => {
      probe.__exportSaveCalls.push(args)
      if (probeMode === 'cancel') return null
      if (probeMode === 'pending') {
        return await new Promise<string | null>((resolve) => {
          probe.__resolveExportSave = resolve
        })
      }
      return '/tmp/e2e-export.nc'
    }
  }, mode)
}

async function exportSaveCalls(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => {
    const probe = window as unknown as { __exportSaveCalls?: unknown[][] }
    return probe.__exportSaveCalls ?? []
  })
}

async function lastExportPath(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const module = await import('/src/store/projectStore.ts') as {
      useProjectStore: { getState: () => { lastExportPath: string | null } }
    }
    return module.useProjectStore.getState().lastExportPath
  })
}

test.describe('Export G-code operation checklist smoke', () => {
  test('per-operation export pre-checks only that operation', async ({ app, ui }) => {
    await seedGcodeExportProject(app.page)

    // Selecting an operation row points the Properties-header export action at it.
    await ui.operations.rowByName(app.page, 'Route B').click()
    await ui.operations.propertiesExportButton(app.page, 'Route B').click()

    const dialog = ui.exportDialog.root(app.page)
    await expect(dialog).toBeVisible()
    await expect(ui.exportDialog.operationOptions(app.page)).toHaveCount(2)
    await expect(ui.exportDialog.operationCheckbox(app.page, 'Route A')).not.toBeChecked()
    await expect(ui.exportDialog.operationCheckbox(app.page, 'Route B')).toBeChecked()

    // The GRBL machine is active, so the scoped preview enables Export.
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()

    // Unchecking the last operation disables Export and explains why.
    await ui.exportDialog.operationCheckbox(app.page, 'Route B').uncheck()
    await expect(ui.exportDialog.exportButton(app.page)).toBeDisabled()
    await expect(ui.exportDialog.errors(app.page).filter({
      hasText: 'No operations selected',
    })).toBeVisible()

    // Re-checking the other operation re-enables Export.
    await ui.exportDialog.operationCheckbox(app.page, 'Route A').check()
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()
  })

  test('header export pre-checks the whole visible set', async ({ app, ui }) => {
    await seedGcodeExportProject(app.page)

    await ui.operations.headerExportButton(app.page).click()

    await expect(ui.exportDialog.root(app.page)).toBeVisible()
    await expect(ui.exportDialog.operationCheckbox(app.page, 'Route A')).toBeChecked()
    await expect(ui.exportDialog.operationCheckbox(app.page, 'Route B')).toBeChecked()
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()

    // The header toggle flips the whole selection: Deselect all → Select all.
    const toggle = ui.exportDialog.selectionToggle(app.page)
    await expect(toggle).toHaveText('Deselect all')
    await toggle.click()
    await expect(ui.exportDialog.operationCheckbox(app.page, 'Route A')).not.toBeChecked()
    await expect(ui.exportDialog.operationCheckbox(app.page, 'Route B')).not.toBeChecked()
    await expect(ui.exportDialog.exportButton(app.page)).toBeDisabled()
    await expect(toggle).toHaveText('Select all')
    await toggle.click()
    await expect(ui.exportDialog.operationCheckbox(app.page, 'Route A')).toBeChecked()
    await expect(ui.exportDialog.operationCheckbox(app.page, 'Route B')).toBeChecked()
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()
  })

  test('one tool across the program with tool changes off stays clean', async ({ app, ui }) => {
    await seedGcodeExportProject(app.page)
    await ui.operations.headerExportButton(app.page).click()

    // A ready program reports its total line count; the dialog shows nothing
    // while a preparation is in flight, which reads as 0 here.
    const reportedLines = async (): Promise<number> => {
      const summary = ui.exportPreview.summary(app.page)
      if (await summary.count() === 0) return 0
      const match = /(\d+) lines total/.exec((await summary.textContent()) ?? '')
      return match ? Number(match[1]) : 0
    }

    await expect.poll(reportedLines).toBeGreaterThan(0)
    const withToolChanges = await reportedLines()

    await ui.exportDialog.emitToolChanges(app.page).uncheck()

    // Rebuilding the program takes a debounce, and the change commands it drops
    // (with the spindle restart for the next operation) sit past the 30-line
    // preview, so the reported line count falling is the only whole-program
    // signal available. It has to fall *to a ready program*: the dialog reports
    // no count at all while a preparation is in flight, and "0 < before" would
    // otherwise let the assertions below describe that empty state rather than
    // the rebuilt program. Both routes share a tool, so nothing was left
    // unexecuted and there is no error.
    await expect.poll(async () => {
      const lines = await reportedLines()
      return lines > 0 && lines < withToolChanges
    }).toBe(true)
    await expect(ui.exportDialog.errors(app.page)).toHaveCount(0)
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()
  })

  test('a real tool change with tool changes off blocks the export', async ({ app, ui }) => {
    await seedGcodeExportProject(app.page, { routeBOnSecondTool: true })
    await ui.operations.headerExportButton(app.page).click()

    await ui.exportDialog.emitToolChanges(app.page).uncheck()

    // Route B would run with Route A's tool and nothing in the program pauses
    // the machine for a change, so this blocks the export rather than noting it.
    await expect(ui.exportDialog.errors(app.page).filter({ hasText: 'Route B' })).toBeVisible()
    await expect(ui.exportDialog.exportButton(app.page)).toBeDisabled()

    // Emitting the change is the fix the message asks for, and it clears the
    // error once the rebuilt program lands.
    await ui.exportDialog.emitToolChanges(app.page).check()
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()
    await expect(ui.exportDialog.errors(app.page)).toHaveCount(0)
  })
})

test.describe('Export G-code destination smoke (#1081)', () => {
  test('every export asks for a destination, even after a successful export', async ({ app, ui }) => {
    await seedGcodeExportProject(app.page)
    await installExportSaveProbe(app.page, 'success')

    const dialog = ui.exportDialog.root(app.page)

    await ui.operations.headerExportButton(app.page).click()
    await expect(dialog).toBeVisible()
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()
    await ui.exportDialog.exportButton(app.page).click()
    await expect(dialog).toBeHidden()

    let calls = await exportSaveCalls(app.page)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveLength(4)
    expect(calls[0]?.[3]).toBeNull()
    const firstSuggestedName = calls[0]?.[0]

    // Same document and same remembered export path, but a rename and a
    // changed operation selection alter the suggested name. It must still ask.
    await app.page.evaluate(async () => {
      const module = await import('/src/store/projectStore.ts') as {
        useProjectStore: { getState: () => { setProjectName: (name: string) => void } }
      }
      module.useProjectStore.getState().setProjectName('Renamed Part')
    })

    await ui.operations.headerExportButton(app.page).click()
    await expect(dialog).toBeVisible()
    await ui.exportDialog.operationCheckbox(app.page, 'Route B').uncheck()
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()
    await ui.exportDialog.exportButton(app.page).click()
    await expect(dialog).toBeHidden()

    calls = await exportSaveCalls(app.page)
    expect(calls).toHaveLength(2)
    expect(calls[1]).toHaveLength(4)
    expect(calls[1]?.[3]).toBeNull()
    expect(calls[1]?.[0]).not.toBe(firstSuggestedName)
    expect(calls[1]?.[0]).toContain('Renamed_Part')
  })

  test('cancelling the destination neither closes the dialog nor marks an export', async ({ app, ui }) => {
    await seedGcodeExportProject(app.page)
    await installExportSaveProbe(app.page, 'cancel')

    const dialog = ui.exportDialog.root(app.page)
    await ui.operations.headerExportButton(app.page).click()
    await expect(dialog).toBeVisible()
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()

    await ui.exportDialog.exportButton(app.page).click()
    await expect.poll(async () => (await exportSaveCalls(app.page)).length).toBe(1)

    const calls = await exportSaveCalls(app.page)
    expect(calls[0]).toHaveLength(4)
    expect(calls[0]?.[3]).toBeNull()
    await expect(dialog).toBeVisible()
    expect(await lastExportPath(app.page)).toBeNull()
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()
  })

  test('a destination chosen during an in-flight save is not attributed to a switched document', async ({ app, ui }) => {
    await seedGcodeExportProject(app.page)
    await installExportSaveProbe(app.page, 'pending')

    const dialog = ui.exportDialog.root(app.page)
    await ui.operations.headerExportButton(app.page).click()
    await expect(dialog).toBeVisible()
    await expect(ui.exportDialog.exportButton(app.page)).toBeEnabled()

    await ui.exportDialog.exportButton(app.page).click()
    await expect.poll(async () => (await exportSaveCalls(app.page)).length).toBe(1)
    await expect(dialog).toBeVisible()

    // Swap documents while the platform save promise is still open.
    await app.page.evaluate(async () => {
      const w = window as unknown as {
        __pcTest: { getProject: () => Promise<Record<string, unknown>>; loadProject: (json: string) => Promise<void> }
      }
      const project = await w.__pcTest.getProject()
      const meta = project.meta as Record<string, unknown>
      project.meta = { ...meta, name: 'Switched project' }
      await w.__pcTest.loadProject(JSON.stringify(project))
    })
    await expect(dialog).toBeVisible()

    await app.page.evaluate(() => {
      const probe = window as unknown as { __resolveExportSave?: ((path: string | null) => void) | null }
      probe.__resolveExportSave?.('/tmp/previous-project.nc')
    })

    // The async document-identity check closes the dialog without marking the
    // switched project exported (issue #675) and without clearing the marker
    // the switch already reset.
    await expect(dialog).toBeHidden()
    expect(await lastExportPath(app.page)).toBeNull()
  })
})
