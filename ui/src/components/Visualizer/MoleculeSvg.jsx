import React, { useContext } from "react";
import { MainContext } from "../../contexts/MainContext";
import SVGRenderer from "../SvgRenderer";

const MoleculeSvg = ({ molId }) => {
  const { molecules } = useContext(MainContext);

  if (!molecules || !molecules[molId] || molecules[molId] === null) {
    return <p>No molecule data found</p>;
  }

  return <SVGRenderer svgText={molecules[molId]} />;
};

export default MoleculeSvg;
