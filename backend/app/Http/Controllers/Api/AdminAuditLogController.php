<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use Illuminate\Http\Request;

class AdminAuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AdminLog::with('admin')->latest('performed_at');

        if ($request->filled('action')) {
            $query->where('action', $request->query('action'));
        }

        if ($request->filled('admin_id')) {
            $query->where('admin_id', $request->query('admin_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('performed_at', '>=', $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('performed_at', '<=', $request->query('date_to'));
        }

        return response()->json($query->paginate(30));
    }
}
