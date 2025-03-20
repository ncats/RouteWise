import React, { useContext } from "react";
import { Alert, Divider } from "antd";
import { MainContext } from "../../contexts/MainContext";

const GraphPending = () => {
  const { appSettings } = useContext(MainContext);
  const hasJoinError = !!appSettings.joinRoomError;

  return (
    <Divider>
      {hasJoinError && (
        <Alert message={appSettings.joinRoomError} type="error" showIcon />
      )}
      {!hasJoinError && (
        <Alert message="Waiting for a graph" type="info" showIcon />
      )}
    </Divider>
  );
};

export default GraphPending;
