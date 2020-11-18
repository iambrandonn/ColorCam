/*global console */

// Load the MP3 to play via AJAX
var analyser
var request = new XMLHttpRequest()
request.open('GET', 'ratherBeWitU2.mp3', true)
request.responseType = 'arraybuffer'
request.onload = function () {
  var audioContext = new AudioContext()
  audioContext.decodeAudioData(request.response, function (buffer) {
    var source = audioContext.createBufferSource()
    source.buffer = buffer
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 32
    source.connect(analyser)
    analyser.connect(audioContext.destination)
    source.noteOn(0)
  })
}
request.send()

// Set up the canvas which will be visible on the page
var canvas = document.getElementById('displayCanvas')
var displayCanvasContext = canvas.getContext('2d')

// Use vendor prefixed getUserMedia if needed
navigator.mediaDevices.getUserMedia =
  navigator.mediaDevices.getUserMedia ||
  navigator.webkitGetUserMedia ||
  undefined
if (navigator.getUserMedia === undefined) {
  if (console !== undefined) {
    console.log("Browser doesn't support getUserMedia")
  }
}

// Start the webcam
navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  // Create a video element and set its source to the stream from the webcam
  var videoElement = document.createElement('video')
  videoElement.style.display = 'none'
  videoElement.autoplay = true
  document.getElementsByTagName('body')[0].appendChild(videoElement)
  if (window.URL === undefined) {
    window.URL = window.webkitURL
  }
  videoElement.srcObject = stream

  // Wait for the video element to initialize
  videoElement.addEventListener('canplay', function () {
    // Now that the video element has been initialized, determine the webcam resolution from it
    var horizontalResolution = videoElement.videoWidth
    var verticalResolution = videoElement.videoHeight

    canvas.width = horizontalResolution
    canvas.height = verticalResolution

    // Create the canvas that we will draw to for determining motion
    var greyScaleCnvs = document.createElement('canvas')
    greyScaleCnvs.width = horizontalResolution
    greyScaleCnvs.height = verticalResolution
    var greyscaleCtx = greyScaleCnvs.getContext('2d')
    var currentImageData = greyscaleCtx.createImageData(
      horizontalResolution,
      verticalResolution
    )

    // Initialize some variables we will reference each frame
    var PIXEL_CHANGE_THRESHOLD = 12
    var previousImageData
    var lightLevel = 0
    var hue = 0

    // every 30th of a second, sample the video stream
    window.webcamSwiperInterval = setInterval(analyzeCurrentFrame, 1000 / 30)

    // code to process every frame of the video
    function analyzeCurrentFrame () {
      // Rotate through the hues
      hue += 2
      if (hue > 360) {
        hue = 0
      }

      // Get current color
      var data = new Uint8Array(32)
      if (analyser === undefined) {
        data = [0]
      } else {
        analyser.getByteFrequencyData(data)
      }

      var currentBrushColor = hsl2rgb(
        hue,
        Math.round(data[0] / 2),
        Math.round(100 - data[0] * 0.25)
      )

      // The motion detection is more sensitive when the music volume is higher
      PIXEL_CHANGE_THRESHOLD = 61 - 0.285 * data[0]

      // store the current image for comparison next time
      previousImageData = currentImageData

      // Draw the current video frame onto a canvas so we can desaturate the image
      greyscaleCtx.drawImage(
        videoElement,
        0,
        0,
        horizontalResolution,
        verticalResolution,
        0,
        0,
        horizontalResolution,
        verticalResolution
      )

      // Start the process of desaturating it
      var imageData = greyscaleCtx.getImageData(
        0,
        0,
        horizontalResolution,
        verticalResolution
      )
      var displayImageData = displayCanvasContext.getImageData(
        0,
        0,
        horizontalResolution,
        verticalResolution
      )
      currentImageData = greyscaleCtx.createImageData(imageData)

      var theData = imageData.data
      var previousData = previousImageData.data
      var newData = currentImageData.data
      var displayData = displayImageData.data

      // Iterate through each pixel, desaturating it and fading it where necessary
      var dataLength = theData.length
      for (var i = 0; i < dataLength; i += 4) {
        // To find the desaturated value, average the brightness of the red, green, and blue values
        var average = (theData[i] + theData[i + 1] + theData[i + 2]) / 3
        newData[i] = newData[i + 1] = newData[i + 2] = average

        // Show the movement
        if (Math.abs(previousData[i] - newData[i]) > PIXEL_CHANGE_THRESHOLD) {
          // Movement detected here.  Show color based on music level
          currentRGB = currentBrushColor
          displayData[i] = currentRGB[0]
          displayData[i + 1] = currentRGB[1]
          displayData[i + 2] = currentRGB[2]
          displayData[i + 3] = 255
        } else {
          // no movement detected at this pixel.  Fade to white
          displayData[i] = displayData[i] < 240 ? displayData[i] + 15 : 255
          displayData[i + 1] =
            displayData[i + 1] < 240 ? displayData[i + 1] + 15 : 255
          displayData[i + 2] =
            displayData[i + 2] < 240 ? displayData[i + 2] + 15 : 255
        }
      }

      // Finally, draw the updated image data to the visible canvas
      displayCanvasContext.putImageData(
        displayImageData,
        0,
        0,
        0,
        0,
        horizontalResolution,
        verticalResolution
      )
    }
  })
})

// Converts a HSL color to a RGB one
function hsl2rgb (h, s, l) {
  var m1, m2, hue
  var r, g, b
  s /= 100
  l /= 100
  if (s === 0) r = g = b = l * 255
  else {
    if (l <= 0.5) m2 = l * (s + 1)
    else m2 = l + s - l * s
    m1 = l * 2 - m2
    hue = h / 360
    r = HueToRgb(m1, m2, hue + 1 / 3)
    g = HueToRgb(m1, m2, hue)
    b = HueToRgb(m1, m2, hue - 1 / 3)
  }
  return [r, g, b]
}

// helper function for hsl2rgb
function HueToRgb (m1, m2, hue) {
  var v
  if (hue < 0) hue += 1
  else if (hue > 1) hue -= 1

  if (6 * hue < 1) v = m1 + (m2 - m1) * hue * 6
  else if (2 * hue < 1) v = m2
  else if (3 * hue < 2) v = m1 + (m2 - m1) * (2 / 3 - hue) * 6
  else v = m1

  return 255 * v
}
