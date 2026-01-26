<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailLog;
use Illuminate\Http\Request;

class AdminEmailLogsController extends Controller
{
    public function index(Request $request)
    {
        $query = EmailLog::with('user')->latest('id');

        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($request->filled('email')) {
            $email = $request->query('email');
            $query->where('to', 'like', "%{$email}%");
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->paginate($perPage));
    }
}
