import React, { CSSProperties } from "react";
import Select, { ControlProps } from "react-select";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledSelect = (props: any) => {
  const customStyles = {
    control: (provided: CSSProperties, state: ControlProps) => ({
      ...provided,
      borderRadius: "10px",
      background: "none",
      borderColor: state.isFocused ? "hsl(var(--border))" : "hsl(var(--border) / 0.5)",
      borderWidth: "2px",
      boxShadow: "none",
      cursor: "pointer",
      color: "hsl(var(--foreground))",
      "&:hover": {
        borderColor: "hsl(var(--border))",
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    option: (provided: CSSProperties, state: any) => ({
      ...provided,
      background: state.isSelected ? "rgba(255, 255, 255, 0.2)" : "none",
      color: "hsl(var(--foreground))",
      cursor: "pointer",
      "&:hover": {
        background: "rgba(255, 255, 255, 0.2)",
      },
    }),
    menu: (provided: CSSProperties) => ({
      ...provided,
      zIndex: 10,
      borderRadius: "10px",
      background: "hsl(var(--accent-purple))",
    }),
    singleValue: (provided: CSSProperties) => ({
      ...provided,
      color: "hsl(var(--foreground))",
    }),
    input: (provided: CSSProperties) => ({
      ...provided,
      color: "hsl(var(--foreground))",
    }),
    placeholder: (provided: CSSProperties) => ({
      ...provided,
      color: "rgba(255,255,255, 0.6)",
    }),
    dropdownIndicator: (provided: CSSProperties) => ({
      ...provided,
      color: "rgba(255, 255, 255, 0.6)",
      "&:hover": {
        color: "rgba(255, 255, 255, 1)",
      },
    }),
  };

  return <Select {...props} styles={customStyles} />;
};

export default StyledSelect;
