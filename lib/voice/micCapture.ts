// 封装麦克风采集生命周期：getUserMedia → AudioContext(16kHz) → AudioWorklet → PCM 回调。
// 调用方只需关心 start(onChunk) 和 stop()，无需直接操作 Web Audio API。

export class MicCapture {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  // start() 是异步的（await getUserMedia / addModule）。若在 await 期间 stop() 被调用，
  // 必须让 start() 的后续代码感知并干净退出，否则会用到已关闭的 ctx 抛错。
  private stopped = false;

  async start(onChunk: (pcm: ArrayBuffer) => void): Promise<void> {
    this.stopped = false;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true },
    });
    if (this.stopped) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    this.stream = stream;

    // 强制 16kHz：讯飞 IAT 要求 audio/L16;rate=16000
    const ctx = new AudioContext({ sampleRate: 16000 });
    await ctx.audioWorklet.addModule('/pcm-capture-processor.js');
    if (this.stopped) {
      void ctx.close();
      stream.getTracks().forEach(t => t.stop());
      this.stream = null;
      return;
    }
    this.ctx = ctx;

    this.source = ctx.createMediaStreamSource(stream);
    this.workletNode = new AudioWorkletNode(ctx, 'pcm-capture-processor');
    this.workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (this.stopped) return;
      onChunk(e.data);
    };

    // 连接但不接入 destination（静默采集，不播放回声）
    this.source.connect(this.workletNode);
  }

  stop(): void {
    this.stopped = true;
    this.workletNode?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.source = null;
    this.workletNode = null;
    this.stream = null;
  }
}
