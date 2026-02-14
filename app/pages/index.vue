<script setup lang="ts">
const { isLoggedIn } = useMatrixClient()

onMounted(() => {
  if (isLoggedIn.value) {
    navigateTo('/chat')
  } else {
    navigateTo('/login')
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <span class="text-gray-500">Lade...</span>
  </div>
</template>
