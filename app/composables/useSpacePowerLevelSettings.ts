import { useMatrixClient } from '~/composables/useMatrixClient'
import { saveSpacePowerLevelsContent } from '~/composables/matrix/spaceRolesStateHelpers'
import {
  readPowerLevelFieldValue,
  SPACE_POWER_LEVEL_PERMISSION_FIELDS,
  writePowerLevelFieldValue,
  type SpacePowerLevelPermissionField,
} from '~/utils/matrixSpacePowerLevelSettings'
import { getPowerLevelsContent } from '~/utils/matrixPowerLevels'

export function useSpacePowerLevelSettings(spaceId: Ref<string>) {
  const { client } = useMatrixClient()
  const saveError = ref('')
  const isSaving = ref(false)

  const powerLevelsContent = computed(() => {
    const matrixClient = client.value
    if (!matrixClient || !spaceId.value) {
      return null
    }
    return getPowerLevelsContent(matrixClient, spaceId.value)
  })

  function readFieldValue(field: SpacePowerLevelPermissionField): number {
    return readPowerLevelFieldValue(powerLevelsContent.value, field)
  }

  async function saveFieldValue(
    field: SpacePowerLevelPermissionField,
    powerLevel: number,
  ): Promise<void> {
    const matrixClient = client.value
    if (!matrixClient || !spaceId.value) {
      return
    }
    const current = powerLevelsContent.value ?? {}
    const next = writePowerLevelFieldValue({ ...current }, field, powerLevel)
    saveError.value = ''
    isSaving.value = true
    try {
      await saveSpacePowerLevelsContent(matrixClient, spaceId.value, next)
    } catch (thrownError) {
      saveError.value =
        thrownError instanceof Error
          ? thrownError.message
          : String(thrownError)
      throw thrownError
    } finally {
      isSaving.value = false
    }
  }

  return {
    permissionFields: SPACE_POWER_LEVEL_PERMISSION_FIELDS,
    powerLevelsContent,
    readFieldValue,
    saveFieldValue,
    saveError,
    isSaving,
  }
}
