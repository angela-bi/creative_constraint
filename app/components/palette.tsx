import React, { useState, useEffect } from "react";
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Color, RGB } from "../page";

export type Input = "sound" | "brightness" | "nothing"
export type Mapping = {id: number, color: Color, input: Input, image_path: string}

type PaletteProps = {
    colors: Color[];
    activeColor: Color;
    setActiveColor: React.Dispatch<React.SetStateAction<Color>>;
};

export function Palette({ colors, activeColor, setActiveColor }: PaletteProps) {
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const MAX_MAPPINGS = 7;
    // const [activeMappingId, setActiveMappingId] = useState<number | null>(null); // this is the id number of the mapping who the user is selecting a color for

    // populating mappings
    useEffect(() => {
        const initialMappings = colors.slice(0, MAX_MAPPINGS ).map((color, index) => ({ // excluding first color, white
          id: index,
          color,
          input: "nothing" as Input,
          image_path: "", // placeholder
        }));
        setMappings(initialMappings);
      }, []);
       

    // when color button is clicked
    const handleColorButtonClick = (color: Color) => {
        setActiveColor(color);
    };

    return (
        <div style={{ display: "flex", flexDirection: "row", height: "100%", gap: '20px'}}> 
            {/* <div
            style={{
                position: "fixed",
                bottom: "-200px",
                left: "0px",
                zIndex: 10,
                width: "700px",
                height: '500px',
                backgroundImage: "url('/images/palette.png')",
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                display: "flex",
                flexDirection: "column",
                transform: "rotate(20deg) scale(1.2)",
            }}
            /> */}
            {mappings.map((mapping) => {
                const { id, color, input, image_path } = mapping;
                const isActive = activeColor?.rgb && activeColor.rgb[0] === color.rgb[0] && activeColor.rgb[1] === color.rgb[1] && activeColor.rgb[2] === color.rgb[2];
                // console.log(mapping)

                return (
                    <div
                        key={id}
                        style={{
                            // position: 'absolute',
                            // zIndex: 20,
                            // top: `${pos.y}px`,
                            // left: `${pos.x}px`,
                            backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`,
                            //backgroundImage: `url('/images/ellipse_${color.name}.png')`,
                            width: "50px",
                            height: "50px",
                            borderRadius: '10px',
                            border: "2px solid rgb(0,0,0,0.5)",
                            // backgroundSize: "contain",
                            // backgroundRepeat: "no-repeat",
                            // backgroundPosition: "center",
                            cursor: "pointer",
                            // clipPath: "circle(50% at 50% 50%)",
                            opacity: isActive ? 1 : 0.6,
                            transition: "opacity 0.2s ease-in-out",
                        }}
                        onClick={() => handleColorButtonClick(color)}
                    >
                        {/* {id === 0 && (
                            <div
                            style={{
                                position: "absolute",
                                zIndex: 30,
                                bottom: "60px",
                                left: "60px",
                                width: `${soundLevel}%`,
                                height: "20px",
                                background: "gray",
                                borderRadius: 4,
                                // transition: "width 0.1s linear",
                                pointerEvents: "none",
                            }}
                            />
                        )} */}
                    </div>
                )
            })}
        </div>
    )
}