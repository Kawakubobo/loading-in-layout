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
 let interval = (size >= 32 ? 0.013 : 0.0038) / 0.75 * [0.85,1.1,0.95,1.2][blockIndex % 4]
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
for frame in 0..<977 {
 autoreleasepool {
 var buffer:CVPixelBuffer?;CVPixelBufferPoolCreatePixelBuffer(nil,adaptor.pixelBufferPool!,&buffer)
 CVPixelBufferLockBaseAddress(buffer!,[])
 let cg=CGContext(data:CVPixelBufferGetBaseAddress(buffer!),width:1920,height:1080,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer!),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
 cg.setFillColor(CGColor(gray:1,alpha:1));cg.fill(CGRect(x:0,y:0,width:1920,height:1080))
 cg.translateBy(x:0,y:1080);cg.scaleBy(x:1,y:-1)
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(cgContext:cg,flipped:true)
 let t=Double(frame)/30
 // Exactly 100 of 300 frames contain typography only (scenes 0 and 4).
 let cuts = [0, 69, 152, 275, 423, 573, 747, 862]
 let scene = cuts.lastIndex(where:{$0 <= frame})!
 typeClock = t-Double(cuts[scene])/30;typeOffset=0;blockIndex=scene
 switch scene {
 case 0:
 typeOffset=0.15;blockIndex=0
 text("A\n",210,290,180,1500,0.800000011920929,-0.02)
 typeOffset=0.8502;blockIndex=1
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",1250,85,18,445,1.2000000476837158,0.0)
 typeOffset=0.2594666666666667;blockIndex=2
 text("\nDifferent\n",40,290,180,1500,0.800000011920929,-0.02)
 typeOffset=0.5206;blockIndex=3
 text("\nPerspective",-85,506,180,1500,0.800000011920929,-0.02)
 case 1:
 typeOffset=1.3;blockIndex=0
 text("Thinking Through\nPossibilities",195,340,136,1100,0.800000011920929,-0.02)
 typeOffset=1.822;blockIndex=1
 text("A starting point takes shape.",195,610,18,445,1.2000000476837158,0.0)
 if typeClock >= 0.15 {orbits(1350.0001983642578,550.0001983642578,820,4,typeClock-0.15,2.616666666666667)}
 case 2:
 if typeClock >= 1.1768 {photo(3,40,64,910,610)}
 if typeClock >= 2.6494666666666666 {photo(2,660,250,600,790)}
 typeOffset=1.1768;blockIndex=2
 text("Color Takes Over",350,710,128,1300,0.800000011920929,-0.02)
 typeOffset=1.5202666666666667;blockIndex=3
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",1435,120,18,445,1.2000000476837158,0.0)
 typeOffset=0.15;blockIndex=0
 text("A\n",210,290,180,1500,0.800000011920929,-0.02)
 typeOffset=0.2594666666666667;blockIndex=1
 text("\nDifferent\n",40,290,180,1500,0.800000011920929,-0.02)
 typeOffset=0.5492;blockIndex=2
 text("\nPerspective",-85,506,180,1500,0.800000011920929,-0.02)
 case 3:
 if typeClock >= 0.15 {photo(3,40,540,755,500)}
 if typeClock >= 1.6720666666666664 {photo(2,1590,84,290,425)}
 typeOffset=0.15;blockIndex=2
 text("Another\nPerspective",815,864,56,445,0.800000011920929,-0.02)
 typeOffset=0.5428666666666666;blockIndex=3
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",815,974,18,445,1.2000000476837158,0.0)
 typeOffset=0.15;blockIndex=0
 text("01",815,822,18,445,1.2000000476837158,0.0)
 typeOffset=1.6720666666666664;blockIndex=1
 text("02",1125,82,18,445,1.2000000476837158,0.0)
 typeOffset=1.6720666666666664;blockIndex=2
 text("Color in\nMotion",1125,130,56,445,0.800000011920929,-0.02)
 typeOffset=1.9990666666666663;blockIndex=3
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",1125,246,18,445,1.2000000476837158,0.0)
 typeOffset=3.1282666666666663;blockIndex=0
 text("Shall We Go\nEven Bigger?",-90,100,330,2200,0.800000011920929,-0.02)
 typeOffset=3.911866666666666;blockIndex=1
 text("Color Takes Over",350,710,128,1300,0.800000011920929,-0.02)
 case 4:
 if typeClock >= 0.15 {photo(3,40,64,910,976)}
 if typeClock >= 1.5568 {photo(2,1435,396,445,644)}
 typeOffset=0.15;blockIndex=2
 text("Liquid\nLight",970,196,56,445,0.800000011920929,-0.02)
 typeOffset=0.4276;blockIndex=3
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",970,307,18,290,1.2000000476837158,0.0)
 typeOffset=0.15;blockIndex=0
 text("01",970,68,18,290,1.2000000476837158,0.0)
 typeOffset=1.5568;blockIndex=1
 text("02",1435,68,18,290,1.2000000476837158,0.0)
 typeOffset=1.5568;blockIndex=2
 text("Orange\nCrush",1435,194,56,445,0.800000011920929,-0.02)
 typeOffset=1.8344;blockIndex=3
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",1435,307,18,445,1.2000000476837158,0.0)
 if typeClock >= 2.9636 {orbits(1180.8996124267578,808.9001007080078,820,2,typeClock-2.9636,2.0364)}
 typeOffset=4.1136;blockIndex=2
 text("Even More?",114,-158,503.125,1881.382568359375,0.800000011920929,-0.02)
 case 5:
 typeOffset=0.15;blockIndex=0
 text("Words in\nMotion",-90,100,350,2200,0.800000011920929,-0.02)
 typeOffset=3.3738;blockIndex=1
 text("A New Rhythm",970,590,128,910,0.800000011920929,-0.02)
 typeOffset=4.0326;blockIndex=2
 text("A New Rhythm",215,982,128,910,0.800000011920929,-0.02)
 typeOffset=2.6942;blockIndex=3
 text("A New Rhythm",1348,465,128,910,0.800000011920929,-0.02)
 typeOffset=2.0873999999999997;blockIndex=0
 text("A New Rhythm",670,340,128,910,0.800000011920929,-0.02)
 typeOffset=1.4285999999999999;blockIndex=1
 text("A New Rhythm",960,215,128,910,0.800000011920929,-0.02)
 typeOffset=0.8009999999999999;blockIndex=2
 text("A New Rhythm",50,-26,128,910,0.800000011920929,-0.02)
 typeOffset=4.3102;blockIndex=3
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",1125,790,18,445,1.2000000476837158,0.0)
 case 6:
 if typeClock >= 2.354 {photo(4,527,373,960,540)}
 typeOffset=2.354;blockIndex=1
 text("Bringing It\nTogether",70,712,170,1080,0.800000011920929,-0.02)
 typeOffset=2.8153333333333332;blockIndex=2
 text("References, variations, and composition move forward together.",195,600,18,445,1.2000000476837158,0.0)
 if typeClock >= 0.15 {orbits(1350.0001983642578,550.0001983642578,820,4,typeClock-0.15,3.6833333333333336)}
 typeOffset=1.3;blockIndex=3
 text("Thinking Through\nPossibilities",195,340,136,1100,0.800000011920929,-0.02)
 case 7:
 typeOffset=0.15;blockIndex=0
 text("One More\nPerspective?",-90,100,310,2300,0.800000011920929,-0.02)
 if typeClock >= 0.8894 {photo(3,40,540,755,500)}
 if typeClock >= 2.1858666666666666 {photo(2,1590,84,290,425)}
 typeOffset=0.8894;blockIndex=3
 text("Light on\nWater",815,650,56,445,0.800000011920929,-0.02)
 typeOffset=1.2606;blockIndex=0
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",815,790,18,445,1.2000000476837158,0.0)
 typeOffset=2.1858666666666666;blockIndex=1
 text("The City\nAwakes",1125,130,56,445,0.800000011920929,-0.02)
 typeOffset=2.5518666666666667;blockIndex=2
 text("Letters arrive in quick succession. Scale and space change the pace, turning a few words into a moving composition.",1125,270,18,445,1.2000000476837158,0.0)
 default: break
 }
 NSGraphicsContext.restoreGraphicsState()
 if [280, 310, 345, 413].contains(frame) {
 let rep=NSBitmapImageRep(cgImage:cg.makeImage()!)
 try! rep.representation(using:.png,properties:[:])!.write(to:root.appendingPathComponent("exports/prompt-v6-\(frame).png"))
 }
 CVPixelBufferUnlockBaseAddress(buffer!,[])
 while !input.isReadyForMoreMediaData {Thread.sleep(forTimeInterval:0.003)}
 if !adaptor.append(buffer!,withPresentationTime:CMTime(value:Int64(frame),timescale:30)){fatalError("Frame encoding failed")}
 }
}
input.markAsFinished();writer.endSession(atSourceTime:CMTime(value:977,timescale:30))
let done=DispatchSemaphore(value:0);writer.finishWriting{done.signal()};done.wait()
guard writer.status == .completed else {fatalError("\(String(describing:writer.error))")}
print("Completed prompt-paced, 1920x1080 eight-layout typewriter video with activity orbits")
