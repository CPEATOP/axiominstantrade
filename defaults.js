// Общие настройки по умолчанию (используются и в content.js, и в popup.js)
var AXBG_DEFAULTS = {
  enabled: true,
  mode: "gradient",        // color | gradient | image
  color: "#0d0f1a",
  grad1: "#2a0f4a",
  grad2: "#06303a",
  gradAngle: 135,
  imageData: "",           // картинка, загруженная с компьютера (dataURL)
  imageUrl: "",            // или ссылка на картинку
  imageFit: "cover",       // cover | contain | tile
  imagePos: "center",
  opacity: 100,            // прозрачность фона, %
  blur: 0,                 // размытие фона, px
  dim: 25,                 // затемнение поверх фона, %
  clearInner: true,        // сделать внутренние блоки прозрачными, чтобы фон был виден
  selector: ""             // CSS-селектор панели, если выбрана вручную
};
