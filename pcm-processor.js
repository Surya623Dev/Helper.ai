// pcm-processor.js
const TARGET_SAMPLE_RATE = 16000;

class PcmProcessor extends AudioWorkletProcessor {
  
  // Custom property to store the context's sample rate (available only in process)
  // WorkletGlobalScope has sampleRate property but we will use the one derived from context.
  
  /**
   * Converts Float32Array to 16-bit PCM (Int16Array) and downsamples if needed.
   */
  convertAndDownsampleAudio(buffer, inputSampleRate) {
    // Check if downsampling is required
    if (inputSampleRate === TARGET_SAMPLE_RATE) {
      const pcm16 = new Int16Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        const s = Math.max(-1, Math.min(1, buffer[i]));
        // Conversion from Float32 (-1.0 to 1.0) to signed 16-bit integer
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return pcm16;
    }

    // Downsampling is required
    const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
    const newLength = Math.round(buffer.length / ratio);
    const downsampled = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const idx = Math.round(i * ratio);
      const s = buffer[idx] || 0;
      const clamped = Math.max(-1, Math.min(1, s));
      downsampled[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return downsampled;
  }

  process(inputs, outputs, parameters) {
    // inputs[0] is the audio data array
    const input = inputs[0];
    
    // Check if we received audio data on the first channel
    if (input.length > 0 && input[0].length > 0) {
      const floatSamples = input[0];
      
      // The global variable 'sampleRate' in AudioWorkletGlobalScope holds the context's sample rate
      const pcm16Data = this.convertAndDownsampleAudio(floatSamples, sampleRate);
      
      // Send the processed PCM data (as an ArrayBuffer) back to the main thread
      // Transferable objects are sent without copying for performance
      this.port.postMessage(pcm16Data.buffer, [pcm16Data.buffer]);
    }
    
    // Return true to keep the processor running
    return true;
  }
}

// Register the processor with a name used by the main thread
registerProcessor('pcm-processor', PcmProcessor);
