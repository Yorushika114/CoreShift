// 接收讯飞返回的 16kHz 16-bit signed PCM 帧，用 AudioContext 链式调度流式播放。
// 每次 speak() 调用前须先 reset()，确保新语音从当前时刻开始而非追加到上次末尾。

export class PcmStreamPlayer {
  private ctx: AudioContext;
  private nextPlayTime = 0;
  private readonly sampleRate: number;

  constructor(sampleRate = 16000) {
    this.ctx = new AudioContext({ sampleRate });
    this.sampleRate = sampleRate;
  }

  /** 将 AudioContext 从 suspended 唤醒（需在用户手势后调用）。 */
  resume(): void {
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  /** 重置播放指针，使下一帧从当前时刻起播放。 */
  reset(): void {
    this.nextPlayTime = 0;
  }

  /** 追加一段 PCM 数据（Int16 Little-Endian）到播放队列。 */
  feed(pcmBuffer: ArrayBuffer): void {
    const int16 = new Int16Array(pcmBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = this.ctx.createBuffer(1, float32.length, this.sampleRate);
    audioBuffer.copyToChannel(float32, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    const startAt = Math.max(now, this.nextPlayTime);
    source.start(startAt);
    this.nextPlayTime = startAt + audioBuffer.duration;
  }

  close(): void {
    void this.ctx.close();
  }
}
