import "./styles.css";

const video = document.querySelector<HTMLVideoElement>("#demo-video");
const title = document.querySelector("h1");

if (video && title) {
  video.addEventListener("play", () => {
    title.textContent = "Playing with Anidachi";
  });

  video.addEventListener("pause", () => {
    title.textContent = "Anidachi Local Demo";
  });
}
