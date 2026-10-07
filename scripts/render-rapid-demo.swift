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
let photos = ["sayan-nath-iAReN0zr8_U-unsplash.jpg","robert-ritchie-MzbMuF0sv1I-unsplash.jpg","maximilian-bungart-qUtbGNNq5x0-unsplash.jpg","oleg-1lLqsynNaZY-unsplash.jpg"].map { NSImage(contentsOf:root.appendingPathComponent("example/"+$0))! }
let writer = try AVAssetWriter(outputURL:output,fileType:.mp4)
let input = AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:1920,AVVideoHeightKey:1080])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:1920,kCVPixelBufferHeightKey as String:1080])
writer.add(input)
guard writer.startWriting() else { fatalError("\(String(describing:writer.error))") }
writer.startSession(atSourceTime:.zero)
var typeClock = 0.0
var typeOffset = 0.0
var blockIndex = 0
func text(_ value:String,_ x:Double,_ y:Double,_ size:Double,_ width:Double,_ leading:Double=1.2,_ tracking:Double=0) {
 let p = NSMutableParagraphStyle(); p.minimumLineHeight=size*leading; p.maximumLineHeight=size*leading
 let a:[NSAttributedString.Key:Any] = [.font:NSFont(name:name,size:size)!, .foregroundColor:NSColor.black,.paragraphStyle:p,.kern:size*tracking]
 let interval = (size >= 32 ? 0.018 : 0.0048) * [0.85,1.1,0.95,1.2][blockIndex % 4]
 blockIndex += 1
 let visible = max(0,min(value.count,Int((typeClock-typeOffset)/interval)))
 let offset = String(value.prefix(visible)).utf16.count
 let attributed = NSMutableAttributedString(string:value,attributes:a)
 attributed.addAttribute(.foregroundColor,value:NSColor.clear,range:NSRange(location:offset,length:attributed.length-offset))
 attributed.draw(with:NSRect(x:x,y:y,width:width,height:1000),options:[.usesLineFragmentOrigin])
 typeOffset += Double(value.count)*interval
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
 // Exactly 100 of 300 frames contain typography only (scenes 0 and 4).
 let cuts = [0,40,85,135,180,240]
 let scene = cuts.lastIndex(where:{$0 <= frame})!
 typeClock = t-Double(cuts[scene])/30;typeOffset=0;blockIndex=scene
 switch scene {
 case 0:
 text("A Different\nPerspective",195,290,180,1500,0.8,-0.02)
 text("A rhythm made of words, space, and unexpected encounters.",1125,740,18,445)
 case 1:
 photo(0,40,64,910,610);photo(2,660,250,600,790)
 text("Color Takes Over",350,710,128,1300,0.8,-0.02)
 text(bodyB,1435,120,18,445)
 case 2:
 text("Shall We Go\nEven Bigger?",-90,150,350,2200,0.8,-0.02)
 photo(0,40,540,755,500);photo(2,1590,84,290,425)
 typeOffset=0.3
 text("Another\nPerspective",815,650,56,445,0.8,-0.02);text(bodyA,815,790,18,445)
 typeOffset=0.2
 text("Color in\nMotion",1125,130,56,445,0.8,-0.02);text(bodyB,1125,270,18,445)
 case 3:
 photo(3,40,64,910,976);photo(2,1435,396,445,644)
 text("Liquid\nLight",970,660,56,445,0.8,-0.02);text(bodyA,970,790,18,445)
 typeOffset=0.12
 text("Orange\nCrush",1435,112,56,445,0.8,-0.02);text(bodyB,1435,250,18,445)
 case 4:
 text("Words in\nMotion",-90,150,350,2200,0.8,-0.02)
 typeOffset=0.35
 text("A New Rhythm",970,590,128,910,0.8,-0.02)
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",1125,790,18,445)
 case 5:
 text("One More\nPerspective?",-90,150,330,2300,0.8,-0.02)
 photo(3,40,540,755,500);photo(1,1590,84,290,425)
 typeOffset=0.25
 text("Light on\nWater",815,650,56,445,0.8,-0.02);text(bodyA,815,790,18,445)
 typeOffset=0.16
 text("The City\nAwakes",1125,130,56,445,0.8,-0.02);text(bodyB,1125,270,18,445)
 default: break
 }
 NSGraphicsContext.restoreGraphicsState()
 if [12,35,75,125,178,230,295].contains(frame) {
 let rep=NSBitmapImageRep(cgImage:cg.makeImage()!)
 try! rep.representation(using:.png,properties:[:])!.write(to:root.appendingPathComponent("exports/type-third-\(frame).png"))
 }
 CVPixelBufferUnlockBaseAddress(buffer!,[])
 while !input.isReadyForMoreMediaData {Thread.sleep(forTimeInterval:0.003)}
 if !adaptor.append(buffer!,withPresentationTime:CMTime(value:Int64(frame),timescale:30)){fatalError("Frame encoding failed")}
 }
}
input.markAsFinished();writer.endSession(atSourceTime:CMTime(value:10,timescale:1))
let done=DispatchSemaphore(value:0);writer.finishWriting{done.signal()};done.wait()
guard writer.status == .completed else {fatalError("\(String(describing:writer.error))")}
print("Completed 10-second, 1920x1080 six-layout typewriter video")
