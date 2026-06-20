let sharedAudioContext: AudioContext | null = null

export async function playMessageNotifySound(): Promise<void> {
  if (!import.meta.client) {
    return
  }
  try {
    const audioContext = sharedAudioContext ?? new AudioContext()
    sharedAudioContext = audioContext
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const startTime = audioContext.currentTime
    const gainNode = audioContext.createGain()
    gainNode.gain.value = 0.08
    gainNode.connect(audioContext.destination)

    const playTone = (
      frequency: number,
      offsetSeconds: number,
      durationSeconds: number,
    ) => {
      const oscillator = audioContext.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      oscillator.connect(gainNode)
      oscillator.start(startTime + offsetSeconds)
      oscillator.stop(startTime + offsetSeconds + durationSeconds)
    }

    playTone(880, 0, 0.08)
    playTone(660, 0.1, 0.12)
  } catch {
    // Autoplay policy or unsupported audio — ignore.
  }
}
