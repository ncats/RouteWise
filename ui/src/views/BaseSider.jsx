import React, { useState, useContext } from "react";
import { Button, FloatButton, Layout } from "antd";
import { CloseOutlined, ControlTwoTone } from "@ant-design/icons";
import NetworkSearchMenu from "../components/NetworkSearchMenu";
import { MainContext } from "../contexts/MainContext";

const { Sider } = Layout;

const BaseSider = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { setZoomLevel } = useContext(MainContext);

  return (
    <Sider
      id="network-side-menu"
      collapsible
      collapsed={collapsed}
      collapsedWidth={0}
      trigger={null}
      onCollapse={(value) => setCollapsed(value)}
      style={{ backgroundColor: "#eee" }}
      width={350}
    >
      <NetworkSearchMenu />
      <FloatButton.Group
        shape="circle"
        style={{
          left: 15,
          bottom: 15,
        }}
      >
        <Button
          type="dashed"
          icon={collapsed ? <ControlTwoTone /> : <CloseOutlined />}
          onClick={() => {
            setCollapsed(!collapsed); // toggle collapsed state
            
            setTimeout(() => {
              setZoomLevel(Math.random()); // also trigger graph centering
            }, 300);
          }}
        >
          {collapsed ? "RouteWise" : "Hide"}
        </Button>
      </FloatButton.Group>
    </Sider>
  );
};

export default BaseSider;
