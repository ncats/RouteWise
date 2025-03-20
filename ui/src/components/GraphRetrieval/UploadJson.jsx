import React, { useState, useContext } from "react";
import { Upload, Button, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { MainContext } from "../../contexts/MainContext";
import { mapGraphDataToCytoscape, convertCytoscapeToNormalFormat } from "../../helpers/commonHelpers";

const UploadJson = ({ convertToNormalFormat = false }) => {
  const [jsonFile, setJsonFile] = useState(null);
  const [open, setOpen] = useState(false);

  const { setAicpGraph, updateCytoscapeGraph } = useContext(MainContext);

  const handleJsonChange = async (info) => {
    const fileList = [...info.fileList]; // Copy the file list to avoid mutation

    // Set the file if a file is selected
    if (fileList.length > 0) {
      const selectedFile = fileList[fileList.length - 1].originFileObj;
      setJsonFile(selectedFile);
      await handleUpload(selectedFile);
    } else {
      // Clear file if the file list is empty
      setJsonFile(null);
    }
  };

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result); // Resolve with the file content
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleUpload = async (file) => {
    if (!file) return; // No file selected, do nothing
    message.loading({ content: 'Processing file...', key: 'upload' });

    const fileContent = await readFileContent(file);

    try {
      // parse JSON file content
      const data = JSON.parse(fileContent);

      // If we need to convert from Cytoscape format, call the conversion function
      const finalData = convertToNormalFormat
        ? convertCytoscapeToNormalFormat(data)
        : data;

      // Update the graph with the final data
      setAicpGraph(finalData);

      console.log("finalData", finalData);
      const mappedData = mapGraphDataToCytoscape(finalData);
      console.log("mappedData", mappedData);
      updateCytoscapeGraph(mappedData);


      setJsonFile(null); // Clear the file after successful upload
      setOpen(false); // Close the popover
      message.success({ content: 'File processed successfully', key: 'upload' });
    } catch (error) {
      const errorMessage = error instanceof SyntaxError
        ? 'Invalid JSON format. Please check the file contents.'
        : 'Unable to process graph data. Please ensure correct format.';
      message.error({ content: errorMessage, key: 'upload' });
      setAicpGraph(null);
      setJsonFile(null); // Clear the file after unsuccessful upload
      setOpen(false);
    }
  };

  const props = {
    beforeUpload: (file) => {
      const isJSON = file.type === "application/json";
      if (!isJSON) {
        message.error(`${file.name} is not a JSON file`);
      }
      return isJSON || Upload.LIST_IGNORE;
    },
  };

  const customRequest = ({ file, onSuccess }) => {
    setTimeout(() => {
      onSuccess("ok");
    }, 0);
  };

  const UPLOAD_TITLE = "Upload Valid JSON File";

  return (
    <div className="upload-container">
      <h4>{UPLOAD_TITLE}</h4>
      <Upload
        onChange={handleJsonChange}
        beforeUpload={props.beforeUpload}
        customRequest={customRequest}
        fileList={jsonFile ? [jsonFile] : []} // Display the selected file, if any
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />}>Select JSON file</Button>
      </Upload>
      <p style={{ fontSize: "12px", color: "gray" }}>
        Note: Node SVGs will only populate when the uploaded JSON contains
        `base64svg` within it.
      </p>
    </div>
  );
};

export default UploadJson;
