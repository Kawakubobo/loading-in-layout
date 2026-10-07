import Foundation
import AVFoundation
import AppKit
let args = CommandLine.arguments
let directory = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
let frames = try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent("frames.json"))) as! [[String:Any]]
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey:1920, AVVideoHeightKey:1080])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input, sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:1920,kCVPixelBufferHeightKey as String:1080])
writer.add(input)
guard writer.startWriting() else { fatalError("Cannot start export: \(String(describing:writer.error))") }
writer.startSession(atSourceTime:.zero)
let capture = try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent("capture-region.json"))) as! [String:Double]
var lastCanvas: CGImage?
var rejectedFrames = 0
for index in 0..<300 {
 let time = Double(index)/30
 let frame = frames.last(where:{($0["time"] as! Double)<=time}) ?? frames[0]
 let image = NSImage(contentsOf: directory.appendingPathComponent(frame["file"] as! String))!
 var rect = CGRect(origin:.zero,size:image.size)
 let cg = image.cgImage(forProposedRect:&rect,context:nil,hints:nil)!
 var buffer:CVPixelBuffer?
 CVPixelBufferPoolCreatePixelBuffer(nil,adaptor.pixelBufferPool!,&buffer)
 CVPixelBufferLockBaseAddress(buffer!,[])
 let context = CGContext(data:CVPixelBufferGetBaseAddress(buffer!),width:1920,height:1080,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer!),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
 let width = Double(cg.width), height = Double(cg.height)
 let cropWidth = capture["width"]!, cropHeight = capture["height"]!
 var canvas: CGImage?
 if abs(width-cropWidth) <= 2 && abs(height-cropHeight) <= 2 {
   canvas = cg
 } else if abs(width-capture["viewportWidth"]!) <= 2 && abs(height-capture["viewportHeight"]!) <= 2 {
   canvas = cg.cropping(to:CGRect(x:capture["x"]!,y:capture["y"]!,width:cropWidth,height:cropHeight).integral)
 }
 if let safeCanvas = canvas { lastCanvas = safeCanvas }
 else { rejectedFrames += 1 }
 guard let safeCanvas = lastCanvas else { fatalError("First frame does not match the recorded canvas bounds. Refusing to export window chrome.") }
 context.draw(safeCanvas,in:CGRect(x:0,y:0,width:1920,height:1080))
 CVPixelBufferUnlockBaseAddress(buffer!,[])
 while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval:0.005) }
 if !adaptor.append(buffer!,withPresentationTime:CMTime(value:Int64(index),timescale:30)) { fatalError("Frame failed: \(String(describing:writer.error))") }
}
input.markAsFinished()
writer.endSession(atSourceTime:CMTime(seconds:10,preferredTimescale:30))
let done = DispatchSemaphore(value:0)
writer.finishWriting { done.signal() }
done.wait()
guard writer.status == .completed else { fatalError("Export failed: \(String(describing:writer.error))") }
print("Exported 1920x1080 H.264, 30 fps, 10 seconds: \(output.path)")

print("Frames held because capture dimensions changed: \(rejectedFrames)")
