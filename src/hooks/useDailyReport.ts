import { useEffect, useRef } from 'react';
import { collection, query, where, getDocs, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { sendRevenueReport, ReportStats } from '../lib/email';
import { toast } from 'sonner';

export function useDailyReport(role: "admin" | "staff" | null) {
  const hasTriggeredToday = useRef(false);

  useEffect(() => {
    // Only admins should trigger the auto-report to prevent duplicate triggers from staff
    if (role !== "admin") return;

    const checkAndSendReport = async () => {
      const now = new Date();
      // Check if it's 11 PM (23:00 to 23:59)
      if (now.getHours() === 23 && !hasTriggeredToday.current) {
        hasTriggeredToday.current = true;
        
        // Use local date for the document ID to ensure it's unique per day
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        try {
          // 1. Check if report was already sent today by *any* open admin dashboard
          const reportDocRef = doc(db, 'reports', todayStr);
          const reportDocSnap = await getDoc(reportDocRef);
          
          if (reportDocSnap.exists()) {
            console.log("Daily report already sent for today by another session.");
            return;
          }

          console.log("Compiling and sending 11 PM daily revenue report...");
          
          // 2. Prevent race conditions by immediately setting a placeholder doc
          await setDoc(reportDocRef, {
            status: "sending",
            startedAt: serverTimestamp()
          });
          
          // 3. Get today's orders
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          
          const ordersSnap = await getDocs(query(
            collection(db, 'orders'),
            where('createdAt', '>=', startOfDay)
          ));
          
          let totalRevenue = 0;
          let completedCount = 0;
          let cancelledCount = 0;
          const itemsMap = new Map<string, number>();
          
          ordersSnap.forEach((docSnap) => {
            const order = docSnap.data();
            if (order.status === 'cancelled') {
              cancelledCount++;
            } else {
              completedCount++;
              totalRevenue += order.total || 0;
              
              const items = order.items || [];
              items.forEach((item: any) => {
                itemsMap.set(item.name, (itemsMap.get(item.name) || 0) + item.quantity);
              });
            }
          });
          
          const topItems = Array.from(itemsMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
            
          const averageOrderValue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;
          
          const stats: ReportStats = {
            period: now.toLocaleDateString(),
            totalRevenue,
            totalOrders: completedCount + cancelledCount,
            completedOrders: completedCount,
            cancelledOrders: cancelledCount,
            averageOrderValue,
            topItems
          };
          
          // 4. Send email
          await sendRevenueReport(stats);
          
          // 5. Update the DB doc to success
          await setDoc(reportDocRef, {
            status: "sent",
            sentAt: serverTimestamp(),
            stats
          }, { merge: true });
          
          toast.success("Automated 11 PM Revenue Report sent successfully!");
          
        } catch (error: any) {
          console.error("Failed to send automated daily report:", error);
          if (error.message?.includes("credentials not configured")) {
            console.warn("Skipping auto-report: EmailJS credentials missing in src/lib/email.ts");
          }
          // Remove the placeholder doc so it can try again later
          hasTriggeredToday.current = false;
        }
      } else if (now.getHours() !== 23) {
        // Reset flag if it's no longer 11 PM (e.g., next day)
        hasTriggeredToday.current = false;
      }
    };

    // Check every 60 seconds
    const interval = setInterval(checkAndSendReport, 60000);
    
    // Initial check in case they open the app exactly at 11:xx PM
    checkAndSendReport();
    
    return () => clearInterval(interval);
  }, [role]);
}
