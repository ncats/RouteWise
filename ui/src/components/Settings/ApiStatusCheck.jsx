import React, { useContext } from "react";
import { Flex, Badge } from "antd";
import { MainContext } from "../../contexts/MainContext";

const ApiStatusCheck = () => {
  const { apiStatus } = useContext(MainContext);

  const connected = apiStatus && !apiStatus.error;

  return (
    <Flex gap="middle">
      <div>API connection status:</div>
      <Badge
        status={connected ? "success" : "error"}
        text={connected ? "Connected" : "Not Connected"}
      />
    </Flex>
  );
};

export default ApiStatusCheck;
