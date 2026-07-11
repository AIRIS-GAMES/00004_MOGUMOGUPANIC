Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$rawDir = Join-Path $root 'assets\app-store\raw'
$outDir = Join-Path $root 'assets\app-store\screenshots-ja'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$items = @(
  @{ File = '01-gameplay.png'; Out = '01-gameplay-1320x2868.png'; Title = "吸い込んで、`nエラーを回収！"; Sub = 'ドラッグだけの爽快アクション'; Top = '#63D6E8'; Bottom = '#B8EA91' },
  @{ File = '02-big-cosmy.png'; Out = '02-big-cosmy-1320x2868.png'; Title = 'どんどん大きく！'; Sub = '車も建物もまるごと吸い込もう'; Top = '#FF8EAD'; Bottom = '#78DCE8'; CropBottom = 20; CropRight = 8 },
  @{ File = '03-stages.png'; Out = '03-stages-1320x2868.png'; Title = '10のゲーム世界を冒険'; Sub = 'ステージごとに景色とオブジェクトが変化'; Top = '#76CFF0'; Bottom = '#AFE39D' },
  @{ File = '04-shop.png'; Out = '04-shop-1320x2868.png'; Title = 'お気に入りのコスミーで挑戦'; Sub = '個性豊かな能力を使いこなそう'; Top = '#FFD56A'; Bottom = '#82D8ED' },
  @{ File = '05-boost.png'; Out = '05-effects-1320x2868.png'; Title = '吸い込み演出をカスタマイズ'; Sub = 'コスモコインで新しいエフェクトを解放'; Top = '#F38DB0'; Bottom = '#8EDFD0' },
  @{ File = '06-final-stage.png'; Out = '06-story-1320x2868.png'; Title = "閉店後のゲームセンターを`n救おう"; Sub = 'コスミーたちの秘密の冒険'; Top = '#F8B45F'; Bottom = '#79C8E8' }
)

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-CenteredText($graphics, $text, $font, $brush, $rect) {
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString($text, $font, $brush, $rect, $format)
  $format.Dispose()
}

foreach ($item in $items) {
  $canvas = [System.Drawing.Bitmap]::new(1320, 2868, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, 1320, 2868),
    [System.Drawing.ColorTranslator]::FromHtml($item.Top),
    [System.Drawing.ColorTranslator]::FromHtml($item.Bottom),
    90
  )
  $g.FillRectangle($gradient, 0, 0, 1320, 2868)

  $pixelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(55, 255, 255, 255))
  foreach ($p in @(@(65,110,36), @(1180,155,52), @(108,470,22), @(1150,510,28), @(1020,280,18), @(265,235,20))) {
    $g.FillRectangle($pixelBrush, $p[0], $p[1], $p[2], $p[2])
  }

  $brandFont = [System.Drawing.Font]::new('Yu Gothic UI', 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $titleSize = if ($item.Title.Length -gt 18) { 67 } else { 80 }
  $titleFont = [System.Drawing.Font]::new('Yu Gothic UI', $titleSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subFont = [System.Drawing.Font]::new('Yu Gothic UI', 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $dark = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 67, 54, 48))
  Draw-CenteredText $g 'MOGU MOGU PANIC' $brandFont $dark ([System.Drawing.RectangleF]::new(80, 68, 1160, 58))
  Draw-CenteredText $g $item.Title $titleFont $white ([System.Drawing.RectangleF]::new(70, 135, 1180, 250))
  Draw-CenteredText $g $item.Sub $subFont $dark ([System.Drawing.RectangleF]::new(70, 385, 1180, 80))

  $source = [System.Drawing.Bitmap]::FromFile((Join-Path $rawDir $item.File))
  $cropRight = if ($item.CropRight) { $item.CropRight } else { 2 }
  $cropBottom = if ($item.CropBottom) { $item.CropBottom } else { 2 }
  $srcRect = [System.Drawing.Rectangle]::new(2, 2, $source.Width - 2 - $cropRight, $source.Height - 2 - $cropBottom)
  $maxW = 1080.0
  $maxH = 2260.0
  $scale = [Math]::Min($maxW / $srcRect.Width, $maxH / $srcRect.Height)
  $screenW = [float]($srcRect.Width * $scale)
  $screenH = [float]($srcRect.Height * $scale)
  $screenX = [float]((1320 - $screenW) / 2)
  $screenY = [float](530 + (2260 - $screenH) / 2)

  $shadowPath = New-RoundedPath ($screenX + 14) ($screenY + 24) $screenW $screenH 34
  $shadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(55, 0, 0, 0))
  $g.FillPath($shadow, $shadowPath)
  $screenPath = New-RoundedPath $screenX $screenY $screenW $screenH 34
  $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 12)
  $g.SetClip($screenPath)
  $g.DrawImage($source, [System.Drawing.RectangleF]::new($screenX, $screenY, $screenW, $screenH), $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.ResetClip()
  $g.DrawPath($borderPen, $screenPath)

  $output = Join-Path $outDir $item.Out
  $canvas.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)

  $borderPen.Dispose(); $screenPath.Dispose(); $shadow.Dispose(); $shadowPath.Dispose()
  $source.Dispose(); $white.Dispose(); $dark.Dispose(); $subFont.Dispose(); $titleFont.Dispose(); $brandFont.Dispose()
  $pixelBrush.Dispose(); $gradient.Dispose(); $g.Dispose(); $canvas.Dispose()
}

Write-Output "Created $($items.Count) App Store screenshots in $outDir"

