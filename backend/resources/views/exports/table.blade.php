<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; }
        h2 { color: #1b5e20; margin-bottom: 4px; }
        .meta { color: #666; font-size: 9px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1b5e20; color: #fff; text-align: left; padding: 5px; }
        td { border: 1px solid #ccc; padding: 4px; }
        tr:nth-child(even) td { background: #f5f5f5; }
    </style>
</head>
<body>
    <h2>Kabul University — {{ $title }}</h2>
    <div class="meta">Generated {{ now()->format('Y-m-d H:i') }} · KU-AMS</div>
    @if(count($rows))
    <table>
        <thead>
            <tr>@foreach($headers as $h)<th>{{ ucfirst(str_replace('_', ' ', $h)) }}</th>@endforeach</tr>
        </thead>
        <tbody>
            @foreach($rows as $row)
            <tr>@foreach($row as $cell)<td>{{ $cell }}</td>@endforeach</tr>
            @endforeach
        </tbody>
    </table>
    @else
    <p>No data available for this report.</p>
    @endif
</body>
</html>
