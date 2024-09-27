window.addEventListener('DOMContentLoaded', (event) => {
  function setImagesDimensions() {
    var images = document.querySelectorAll("#projects img");

    images.forEach(function (image) {
      image.style.width = "100%";
      image.style.height = "auto";
    });
  }
  window.addEventListener("resize", setImagesDimensions);

  setImagesDimensions();
});
