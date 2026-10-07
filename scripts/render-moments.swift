import Foundation
import AppKit
import AVFoundation
import CoreText
let root = URL(fileURLWithPath:CommandLine.arguments[1])
let output = URL(fileURLWithPath:CommandLine.arguments[2])
let fontURL = root.appendingPathComponent("assets/fonts/NeueHaasGroteskDisplay-Regular.ttf")
CTFontManagerRegisterFontsForURL(fontURL as CFURL,.process,nil)
let descriptors = CTFontManagerCreateFontDescriptorsFromURL(fontURL as CFURL) as! [CTFontDescriptor]
let name = CTFontDescriptorCopyAttribute(descriptors[0],kCTFontNameAttribute) as! String
let photos = ["sayan-nath-iAReN0zr8_U-unsplash.jpg","robert-ritchie-MzbMuF0sv1I-unsplash.jpg"].map { NSImage(contentsOf:root.appendingPathComponent("example/"+$0))! }
let writer = try AVAssetWriter(outputURL:output,fileType:.mp4)
let input = AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:1920,AVVideoHeightKey:1080])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:1920,kCVPixelBufferHeightKey as String:1080])
writer.add(input)
guard writer.startWriting() else { fatalError("\(String(describing:writer.error))") }
writer.startSession(atSourceTime:.zero)
func text(_ value:String,_ x:Double,_ y:Double,_ size:Double,_ width:Double,_ leading:Double=1.2,_ tracking:Double=0) {
 let p = NSMutableParagraphStyle(); p.minimumLineHeight=size*leading; p.maximumLineHeight=size*leading
 let a:[NSAttributedString.Key:Any] = [.font:NSFont(name:name,size:size)!, .foregroundColor:NSColor.black,.paragraphStyle:p,.kern:size*tracking]
 (value as NSString).draw(with:NSRect(x:x,y:y,width:width,height:1000),options:[.usesLineFragmentOrigin],attributes:a)
}
func photo(_ n:Int,_ x:Double,_ y:Double,_ w:Double,_ h:Double) {
 let image=photos[n];let iw=Double(image.size.width), ih=Double(image.size.height);let ratio=max(w/iw,h/ih)
 let source=NSRect(x:(iw-w/ratio)/2,y:(ih-h/ratio)/2,width:w/ratio,height:h/ratio)
 image.draw(in:NSRect(x:x,y:y,width:w,height:h),from:source,operation:.sourceOver,fraction:1,respectFlipped:true,hints:nil)
}
let bodyA="A small figure crosses a world of white. Light turns the landscape into a field of quiet gestures.\n        Each ridge holds a different shadow. A familiar place becomes something unexpected when seen from another perspective."
let bodyB="Every window holds another story. Small points of light gather into a city, revealing a rhythm that only appears after dark."
for frame in 0..<300 {
 autoreleasepool {
 var buffer:CVPixelBuffer?;CVPixelBufferPoolCreatePixelBuffer(nil,adaptor.pixelBufferPool!,&buffer)
 CVPixelBufferLockBaseAddress(buffer!,[])
 let cg=CGContext(data:CVPixelBufferGetBaseAddress(buffer!),width:1920,height:1080,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer!),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
 cg.setFillColor(CGColor(gray:1,alpha:1));cg.fill(CGRect(x:0,y:0,width:1920,height:1080))
 cg.translateBy(x:0,y:1080);cg.scaleBy(x:1,y:-1)
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(cgContext:cg,flipped:true)
 let t=Double(frame)/30
 if t<5 {
 let title="Shall We Go\nEven Bigger?"
 let count=min(title.count,Int(t/0.032))
 text(String(title.prefix(count)),-90,150,350,2200,0.8,-0.02)
 photo(0,40,540,755,500);photo(1,1590,84,290,425)
 text("01 PHOTO STUDY",815,620,14,445);text("Another\nPerspective",815,650,56,445,0.8,-0.02);text(bodyA,815,790,18,445)
 text("02 PHOTO STUDY",1125,84,14,445);text("After\nHours",1125,130,56,445,0.8,-0.02);text(bodyB,1125,270,18,445)
 } else {
 photo(0,40,64,910,976);photo(1,1435,396,445,644)
 text("01 PHOTO STUDY",970,624,14,445);text("Another\nPerspective",970,660,56,445,0.8,-0.02);text(bodyA,970,790,18,445)
 text("02 PHOTO STUDY",1435,64,14,445);text("After\nHours",1435,112,56,445,0.8,-0.02);text(bodyB,1435,250,18,445)
 }
 NSGraphicsContext.restoreGraphicsState()
 if frame==140 || frame==290 {
 let rep=NSBitmapImageRep(cgImage:cg.makeImage()!)
 try! rep.representation(using:.png,properties:[:])!.write(to:root.appendingPathComponent("exports/moment-\(frame).png"))
 }
 CVPixelBufferUnlockBaseAddress(buffer!,[])
 while !input.isReadyForMoreMediaData {Thread.sleep(forTimeInterval:0.003)}
 if !adaptor.append(buffer!,withPresentationTime:CMTime(value:Int64(frame),timescale:30)){fatalError("Frame encoding failed")}
 }
}
input.markAsFinished();writer.endSession(atSourceTime:CMTime(value:10,timescale:1))
let done=DispatchSemaphore(value:0);writer.finishWriting{done.signal()};done.wait()
guard writer.status == .completed else {fatalError("\(String(describing:writer.error))")}
print("Completed 10-second, 1920x1080 two-moment video")
