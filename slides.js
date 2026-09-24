// slides.js — the DOM half: which slide is live, and how you move through them.

"use strict";

(() => {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const bar = document.getElementById("bar");
  const counter = document.getElementById("counter");
  const tag = document.getElementById("tag");
  const chips = Array.from(document.querySelectorAll(".chip"));
  let index = -1;

  // -- helpers -------------------------------------------------------------

  function parseFx(text) {
    const out = {};
    if (!text) return out;
    for (const pair of text.split(",")) {
      const [key, value] = pair.split(":");
      out[key.trim()] = parseFloat(value);
    }
    return out;
  }

  function refreshChips() {
    for (const chip of chips) {
      chip.classList.toggle("on", GL.target(chip.dataset.fx) > 0);
    }
  }

  // -- split [data-split] into per-letter animation clocks ------------------

  document.querySelectorAll("[data-split]").forEach((el) => {
    const text = el.textContent;
    el.textContent = "";
    let i = 0;
    for (const ch of text) {
      if (ch === " ") { el.append(ch); continue; }
      const span = document.createElement("span");
      span.className = "char";
      span.style.setProperty("--i", i++);
      span.textContent = ch;
      el.append(span);
    }
  });

  // -- normalize pathLength on every drawn shape: one shared 1-unit clock ----

  document.querySelectorAll(".draw path, .draw circle, .draw rect, .draw polyline").forEach((el) => {
    el.setAttribute("pathLength", "1");
  });

  // -- activation -----------------------------------------------------------

  function show(i) {
    if (i === index || i < 0 || i >= slides.length) return;
    if (index >= 0) slides[index].classList.remove("active");
    index = i;
    const slide = slides[index];
    slide.classList.add("active");

    GL.goTo(Number(slide.dataset.scene || 0));
    GL.applyFx(parseFx(slide.dataset.fx));

    tag.textContent = slide.dataset.tag || "";
    counter.textContent = String(index + 1).padStart(2, "0") + " / " + String(slides.length).padStart(2, "0");
    bar.style.width = ((index + 1) / slides.length) * 100 + "%";
    refreshChips();
  }

  const next = () => show(index + 1);
  const back = () => show(index - 1);

  // -- keyboard --------------------------------------------------------------

  window.addEventListener("keydown", (e) => {
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
      e.preventDefault();
      next();
    } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
      e.preventDefault();
      back();
    } else if (e.key === "Home") {
      show(0);
    } else if (e.key === "End") {
      show(slides.length - 1);
    } else if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } else if (/^[1-5]$/.test(e.key)) {
      const chip = chips[Number(e.key) - 1];
      if (chip) {
        GL.toggleFx(chip.dataset.fx);
        refreshChips();
      }
    }
  });

  // -- wheel (throttled) -------------------------------------------------------

  let wheelAt = 0;
  window.addEventListener("wheel", (e) => {
    const now = performance.now();
    if (now - wheelAt < 700 || Math.abs(e.deltaY) < 24) return;
    wheelAt = now;
    e.deltaY > 0 ? next() : back();
  }, { passive: true });

  // -- touch swipe --------------------------------------------------------------

  let touchY = null;
  window.addEventListener("touchstart", (e) => {
    touchY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (touchY === null) return;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dy) > 48) dy < 0 ? next() : back();
    touchY = null;
  }, { passive: true });

  // -- click to advance (chips excluded) ------------------------------------------

  window.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    next();
  });

  // -- chips ------------------------------------------------------------------------

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      GL.toggleFx(chip.dataset.fx);
      refreshChips();
    });
  });

  show(0);
})();