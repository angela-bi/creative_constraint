import sounddevice as sd
import numpy as np
import bpy

import sys
sys.path.append("/Users/angelabi/.local/lib/python3.11/site-packages") # replace with own path
import cv2

# parts of code from https://github.com/F1dg3tXD/MAD/blob/main/MAD_OSX/mad.py and https://github.com/CGArtPython/blender_plus_python/blob/main/add-ons/simple_custom_panel/simple_custom_panel.py

##################
# HELPER FUNCTIONS 
##################

def get_microphone_items(self, context):
    items = []
    for i, device in enumerate(sd.query_devices()):
        if device["max_input_channels"] > 0:
            label = f"{i}:{device['name']}"
            items.append((label, device["name"], ""))
    return items

##################
# UI ELEMENTS
##################

class InputMappingSettings(bpy.types.PropertyGroup):
    input_source: bpy.props.EnumProperty(
        name="Input Source",
        description="Choose input type",
        items=[
            ('AUDIO', "Audio", "Use microphone input"),
            ('CAMERA', "Camera", "Use webcam input"),
        ],
        default='AUDIO'
    )

class AudioRigSettings(bpy.types.PropertyGroup):
    mic_list: bpy.props.EnumProperty(
        name="Microphone",
        description="Select input device",
        items=get_microphone_items
    )
    volume_scale: bpy.props.FloatProperty(name="Volume to Value Scale", default=1.0)
    # not implemented yet
    recording_length: bpy.props.FloatProperty(name="Recording Length (s)", default=1.0, min=0.0, max=3.0)
    # make more ways to interact with input data


# property group for selecting color channel
checkboxes = 3
checkbox_names = [ "Red", "Green", "Blue"]
class color_channel_settings(bpy.types.PropertyGroup):
    channel_list: bpy.props.BoolVectorProperty(
        name="Channels",
        description="Select color channels",
        size=checkboxes,
        default = (False,) * checkboxes
    )
    

##################
# OPERATORS
##################

# button for changing color based on sound level
class BRUSH_OT_sound_color(bpy.types.Operator):
    bl_idname = "brush.change_brush_color"
    bl_label = "Change Brush Color"
    bl_description = "Use audio input to set a random brush color"
    bl_options = {'REGISTER', 'UNDO'}
    
    def execute(self, context):
        color_channel = context.scene.color_channel
        red = color_channel.channel_list[0]
        green = color_channel.channel_list[1]
        blue = color_channel.channel_list[2]
        try:
            duration = 1 # TODO: make this toggle-able
            sample_rate = 44100
            audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
            sd.wait()
            audio = np.array(audio).flatten()
            print('audio:', audio)
            normalized_audio = (audio - np.min(audio)) / (np.max(audio) - np.min(audio))
            print('normalized audio:', normalized_audio)

            rms = np.linalg.norm(audio) / np.sqrt(len(audio))
            print("RMS Volume:", rms)

            def safe_sample():
                return float(np.random.choice(normalized_audio))
            
            # logic for changing one channel
            channel_choice = context.scene.color_channel.channel_list
            brush = bpy.data.brushes.get("Pencil")
            
            if not brush:
                self.report({'WARNING'}, "Brush Tint not found.")
                return {'CANCELLED'}

            r, g, b = brush.color
            print("old brush rgb", r, g, b)
            new_value = safe_sample()
            
            if red == True:
                r = new_value
            if green == True:
                g = new_value
            if blue == True:
                b = new_value
            
            print("new brush rgb", r, g, b)
            brush.color = (r, g, b)

            return {'FINISHED'}

        except Exception as e:
            self.report({'ERROR'}, f"Error: {str(e)}")
            
            
class BRUSH_OT_camera_color(bpy.types.Operator):
    bl_idname = "brush.change_brush_color_camera"
    bl_label = "Change Brush Color (Camera)"
    bl_description = "Use camera input to set a random brush color"
    bl_options = {'REGISTER', 'UNDO'}
    
    def execute(self, context):
        color_channel = context.scene.color_channel
        red = color_channel.channel_list[0]
        green = color_channel.channel_list[1]
        blue = color_channel.channel_list[2]
        try:
            cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)
            cv2.namedWindow("Webcam Brightness Tracker", cv2.WINDOW_NORMAL)
            arr = []

            while True:
                ret, frame = cap.read()
                if not ret:
                    print("failed to read frame.")
                    break

                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                brightness = np.mean(gray)
                arr.append(brightness)

                cv2.putText(frame, f"Brightness: {brightness:.2f}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

                cv2.imshow("Webcam Brightness Tracker", frame)

                key = cv2.waitKey(1)
                if key == ord('q'):
                    print("exiting")
                    break

            cap.release()
            cv2.destroyAllWindows()

            print('brightness arr:', arr)
            normalized_arr = (arr - np.min(arr)) / (np.max(arr) - np.min(arr))
            sampled_brightness = np.random.choice(normalized_arr)
            
            # logic for changing one channel
            channel_choice = context.scene.color_channel.channel_list
            brush = bpy.data.brushes.get("Pencil")
            
            if not brush:
                self.report({'WARNING'}, "Brush Tint not found.")
                return {'CANCELLED'}

            r, g, b = brush.color
            print("old brush rgb", r, g, b)
            
            if red == True:
                r = sampled_brightness
            if green == True:
                g = sampled_brightness
            if blue == True:
                b = sampled_brightness
            
            print("new brush rgb", r, g, b)
            brush.color = (r, g, b)

            return {'FINISHED'}

        except Exception as e:
            self.report({'ERROR'}, f"Error: {str(e)}")
               

##################
# MAIN UI
##################

class VIEW3D_PT_creative_constraints(bpy.types.Panel):  # class naming convention ‘CATEGORY_PT_name’

    # where to add the panel in the UI
    bl_space_type = "VIEW_3D"  # 3D Viewport area (find list of values here https://docs.blender.org/api/current/bpy_types_enum_items/space_type_items.html#rna-enum-space-type-items)
    bl_region_type = "UI"  # Sidebar region (find list of values here https://docs.blender.org/api/current/bpy_types_enum_items/region_type_items.html#rna-enum-region-type-items)

    bl_category = "Creative Constraints"  # found in the Sidebar
    bl_label = "Input to Output Mapping"  # found at the top of the Panel

    def draw(self, context): # function that defines layout
        layout = self.layout
        scene = context.scene
        input_mapping = scene.input_mapping
        color_channel = scene.color_channel
        audio_rig = scene.audio_rig
        
        layout.label(text="Select Input:")
        layout.prop(input_mapping, "input_source", expand=True)
        row = layout.row()
        
        if input_mapping.input_source == 'AUDIO':
            layout.prop(audio_rig, "mic_list")
            layout.prop(audio_rig, "volume_scale")
            layout.prop(audio_rig, "recording_length")
            
            row = layout.row()
            row.label(text="Channels:")
            # color_channel, "channel_list"
            for idx in range(len(color_channel.channel_list)):
                layout.prop(color_channel, "channel_list", index=idx, text=checkbox_names[idx])
                
            row = layout.row()
            layout.operator("brush.change_brush_color", text="Change Brush Color")

        elif input_mapping.input_source == 'CAMERA':
            row = layout.row()
            row.label(text="Channels:")
            # color_channel, "channel_list"
            for idx in range(len(color_channel.channel_list)):
                layout.prop(color_channel, "channel_list", index=idx, text=checkbox_names[idx])
                
            row = layout.row()
            layout.operator("brush.change_brush_color_camera", text="Change Brush Color (Camera)")
            
        
classes = (
    InputMappingSettings,
    AudioRigSettings,
    color_channel_settings,
    BRUSH_OT_sound_color,
    BRUSH_OT_camera_color,
    VIEW3D_PT_creative_constraints,
)
        

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.color_channel = bpy.props.PointerProperty(type= color_channel_settings) # this creates a variable that can be referenced
    bpy.types.Scene.audio_rig = bpy.props.PointerProperty(type= AudioRigSettings)
    bpy.types.Scene.input_mapping = bpy.props.PointerProperty(type=InputMappingSettings)


def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    del bpy.types.Scene.input_mapping
    del bpy.types.Scene.color_channel
    del bpy.types.Scene.audio_rig


if __name__ == "__main__":
    register()