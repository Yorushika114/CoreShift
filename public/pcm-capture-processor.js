// AudioWorklet processor：在独立音频线程中把 Float32 PCM 转换为 Int16，
// 通过 postMessage 分批发送给主线程。
// 每个 render quantum 约 128 帧（@16kHz = 8ms），无需额外缓冲。

class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      const int16 = new Int16Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        const s = Math.max(-1, Math.min(1, channel[i]));
        int16[i] = s < 0 ? s * 32768 : s * 32767;
      }
      // transferable：零拷贝传输到主线程
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }
    return true; // keep processor alive
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
