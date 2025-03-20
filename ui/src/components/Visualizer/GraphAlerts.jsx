import React, { useContext } from "react";
import { Alert, Divider } from "antd";
import { MainContext } from "../../contexts/MainContext";
import { graphLayouts } from "../../helpers/commonHelpers";

const GraphAlerts = () => {
  const { appSettings, layout } = useContext(MainContext);
  const hasnotDAGError = !!appSettings.notDAGError;

  if (hasnotDAGError && layout === graphLayouts.HIERARCHICAL) {
    return (
      <Divider>
        <Alert message={appSettings.notDAGError} type="error" showIcon />
      </Divider>
    );
  }

  return null;
};

export default GraphAlerts;
