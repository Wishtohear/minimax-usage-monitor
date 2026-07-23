import { onMounted, onBeforeUnmount, ref, watch } from "vue";

/**
 * 把目标时间戳倒计时成 mm:ss 字符串，每秒刷新一次。
 * target: ref<number | null>
 */
export function useCountdown(target: { value: number | null }) {
  const text = ref<string>("--:--");

  let timer: number | null = null;

  function tick() {
    if (target.value == null) {
      text.value = "--:--";
      return;
    }
    const remain = target.value - Date.now();
    if (remain <= 0) {
      text.value = "0:00";
      return;
    }
    const totalSeconds = Math.floor(remain / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      text.value = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    } else {
      text.value = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
  }

  onMounted(() => {
    tick();
    timer = window.setInterval(tick, 1000);
  });
  onBeforeUnmount(() => {
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  });

  watch(target, () => tick());

  return { text };
}