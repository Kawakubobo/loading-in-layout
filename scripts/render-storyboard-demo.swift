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
let photos = ["sayan-nath-iAReN0zr8_U-unsplash.jpg","robert-ritchie-MzbMuF0sv1I-unsplash.jpg","maximilian-bungart-qUtbGNNq5x0-unsplash.jpg","oleg-1lLqsynNaZY-unsplash.jpg","sayan-nath-8qyyTHeI99U-unsplash.jpg"].map { NSImage(contentsOf:root.appendingPathComponent("example/"+$0))! }
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

// Demo-only activity visualization. Rings reflect sample workload, never real tool status.
func orbits(_ cx:Double,_ cy:Double,_ diameter:Double,_ count:Int,_ clock:Double,_ duration:Double) {
 let labels=["Composing layout · ","Comparing variants · ","Searching references · ","Opening project folders · "]
 let font=NSFont(name:name,size:24)!
 for i in 0..<count {
  let appear=Double(i)*0.12
  let exit=duration-0.12-Double(i)*0.12
  if clock < appear || clock >= exit {continue}
  let radius=diameter * (0.14+Double(i)*0.105)
  let attrs:[NSAttributedString.Key:Any]=[.font:font,.foregroundColor:NSColor.black]
  let phrase=labels[i]
  let width=(phrase as NSString).size(withAttributes:attrs).width
  let repeats=max(1,Int(2*Double.pi*radius/width))
  let chars=Array(String(repeating:phrase,count:repeats))
  let widths:[Double]=chars.map{Double((String($0) as NSString).size(withAttributes:attrs).width)}
  let gap=(2*Double.pi*radius-widths.reduce(0,+))/Double(chars.count)
  let direction=i%2==0 ? 1.0 : -1.0
  // Integrate a positive baseline velocity with smooth staggered speed pulses.
  var angle=0.0
  let steps=max(1,Int(clock*120))
  for j in 0..<steps {
   let t=(Double(j)+0.5)*clock/Double(steps)
   let wave=(1+sin(2*Double.pi*(t/1.6-Double(i)*0.17)))/2
   angle += direction*(6+Double(i)+12*pow(wave,3))*clock/Double(steps)*Double.pi/180
  }
  var offset=0.0
  for (j,ch) in chars.enumerated() {
   let a=angle+Double(i)*0.9+(offset+widths[j]/2)/radius
   NSGraphicsContext.saveGraphicsState()
   let ctx=NSGraphicsContext.current!.cgContext
   ctx.translateBy(x:cx+radius*cos(a),y:cy+radius*sin(a))
   ctx.rotate(by:a+Double.pi/2)
   (String(ch) as NSString).draw(at:NSPoint(x:-widths[j]/2,y:-14),withAttributes:attrs)
   NSGraphicsContext.restoreGraphicsState()
   offset += widths[j]+gap
  }
 }
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
 let cuts = [0,40,70,105,150,190,220,265]
 let scene = cuts.lastIndex(where:{$0 <= frame})!
 typeClock = t-Double(cuts[scene])/30;typeOffset=0;blockIndex=scene
 switch scene {
 case 0:
 text("A Different\nPerspective",195,290,180,1500,0.8,-0.02)
 text("A rhythm made of words, space, and unexpected encounters.",1125,740,18,445)
 case 1:
 text("Thinking Through\nPossibilities",195,340,136,1100,0.8,-0.02)
 text("A starting point takes shape.",195,610,18,445)
 orbits(1350,550,820,4,typeClock,1)
 case 2:
 photo(3,40,64,910,610);photo(2,660,250,600,790)
 text("Color Takes Over",350,710,128,1300,0.8,-0.02)
 text(bodyB,1435,120,18,445)
 case 3:
 photo(3,40,540,755,500);photo(2,1590,84,290,425)
 text("Another\nPerspective",815,864,56,445,0.8,-0.02)
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",815,974,18,445)
 typeOffset=0
 text("Color in\nMotion",1125,130,56,445,0.8,-0.02)
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",1125,246,18,445)
 typeOffset=0
 text("Shall We Go\nEven Bigger?",-90,100,330,2200,0.8,-0.02)
 typeOffset=0.2
 text("Color Takes Over",350,710,128,1300,0.8,-0.02)
 case 4:
 photo(3,40,64,910,976);photo(2,1435,396,445,644)
 text("Liquid\nLight",970,196,56,445,0.8,-0.02)
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",970,307,18,290)
 typeOffset=0
 text("Orange\nCrush",1435,194,56,445,0.8,-0.02)
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",1435,307,18,445)
 orbits(1180.9,808.9,820,2,typeClock,40.0/30)
 typeOffset=0
 text("Even\nMore?",114,-158,503.125,1881,0.8,-0.02)
 case 5:
 text("Words in\nMotion",-90,150,350,2200,0.8,-0.02)
 typeOffset=0.1
 text("A New Rhythm",970,590,128,910,0.8,-0.02)
 case 6:
 photo(4,527,373,960,540)
 text("Bringing It\nTogether",70,712,170,1080,0.8,-0.02)
 typeOffset=0.1
 text("References, variations, and composition move forward together.",195,600,18,445)
 orbits(1350,550,820,4,typeClock,1.5)
 typeOffset=0
 text("Thinking Through\nPossibilities",195,340,136,1100,0.8,-0.02)
 case 7:
 text("One More\nPerspective?",-90,150,330,2300,0.8,-0.02)
 photo(3,40,540,755,500);photo(1,1590,84,290,425)
 typeOffset=0.1
 text("Light on\nWater",815,650,56,445,0.8,-0.02);text(bodyA,815,790,18,445)
 typeOffset=0.1
 text("The City\nAwakes",1125,130,56,445,0.8,-0.02);text(bodyB,1125,270,18,445)
 default: break
 }
 NSGraphicsContext.restoreGraphicsState()
 if [35,63,95,142,182,215,255,292].contains(frame) {
 let rep=NSBitmapImageRep(cgImage:cg.makeImage()!)
 try! rep.representation(using:.png,properties:[:])!.write(to:root.appendingPathComponent("exports/storyboard-v3-\(frame).png"))
 }
 CVPixelBufferUnlockBaseAddress(buffer!,[])
 while !input.isReadyForMoreMediaData {Thread.sleep(forTimeInterval:0.003)}
 if !adaptor.append(buffer!,withPresentationTime:CMTime(value:Int64(frame),timescale:30)){fatalError("Frame encoding failed")}
 }
}
input.markAsFinished();writer.endSession(atSourceTime:CMTime(value:10,timescale:1))
let done=DispatchSemaphore(value:0);writer.finishWriting{done.signal()};done.wait()
guard writer.status == .completed else {fatalError("\(String(describing:writer.error))")}
print("Completed 10-second, 1920x1080 eight-layout typewriter video with activity orbits")
