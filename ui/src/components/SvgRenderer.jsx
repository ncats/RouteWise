import React from "react";

function SVGRenderer({ svgText }) {
  return (
    <div style={{ maxWidth: "800px" }}>
      <img src={svgText} alt="" style={{ maxWidth: "100%", height: "auto" }} />
    </div>
  );
}

export default SVGRenderer;
