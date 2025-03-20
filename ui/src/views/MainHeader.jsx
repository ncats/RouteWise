import React, { useContext } from "react";
import NetworkSearchMenu from "../components/NetworkSearchMenu";
import { MainContext } from "../contexts/MainContext";

const MainHeader = () => {
  const { appSettings } = useContext(MainContext);

  return (
    <div id="main-header" className="Main-header-view">
      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={`${appSettings.staticContentPath}/public/molecule.svg`}
          alt="Molecule"
          className="Main-header-logo"
        />
        <h3 className="Main-header-title">Synthesis Route Design</h3>
        <NetworkSearchMenu />
      </div>
    </div>
  );
};

export default MainHeader;